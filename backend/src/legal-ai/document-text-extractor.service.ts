import { Injectable } from "@nestjs/common";
import * as zlib from "zlib";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { DocumentsManagementService } from "../documents/documents-management.service";

export interface ExtractedDocumentText {
  extractedText: string | null;
  truncated: boolean;
  limitation?: string;
}

export interface IDocumentTextExtractor {
  extractAuthorizedText(
    documentId: string,
    ctx: ActiveOrgContext,
    maxChars?: number,
  ): Promise<ExtractedDocumentText>;
}

const MAX_READ_BYTES = 5 * 1024 * 1024; // 5 MB safety cap
const MAX_UNZIPPED_XML_BYTES = 2 * 1024 * 1024; // Anti-ZIP-bomb cap

function decodeXmlEntities(xml: string): string {
  return xml
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    );
}

/**
 * Extrae `word/document.xml` de un archivo OOXML (.docx / ZIP) usando Node.js `zlib`
 * sin dependencias externas y con tope estricto contra ZIP bombs.
 */
function extractTextFromDocxBuffer(buf: Buffer): string | null {
  // Buscar End of Central Directory (EOCD: PK\x05\x06)
  let eocdOffset = -1;
  const searchStart = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (
      buf[i] === 0x50 &&
      buf[i + 1] === 0x4b &&
      buf[i + 2] === 0x05 &&
      buf[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return null;

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  let pos = cdOffset;
  const end = Math.min(buf.length, cdOffset + cdSize);

  while (pos + 46 <= end) {
    if (
      buf[pos] !== 0x50 ||
      buf[pos + 1] !== 0x4b ||
      buf[pos + 2] !== 0x01 ||
      buf[pos + 3] !== 0x02
    ) {
      break;
    }

    const compressionMethod = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const uncompressedSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);

    const fileName = buf
      .subarray(pos + 46, pos + 46 + nameLen)
      .toString("utf8");

    if (fileName === "word/document.xml") {
      if (
        uncompressedSize > MAX_UNZIPPED_XML_BYTES ||
        compressedSize > MAX_READ_BYTES
      ) {
        return null;
      }
      if (localHeaderOffset + 30 > buf.length) return null;
      const lhNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const lhExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buf.length) return null;

      const compressed = buf.subarray(dataStart, dataEnd);
      let xmlBuf: Buffer;
      if (compressionMethod === 0) {
        xmlBuf = compressed;
      } else if (compressionMethod === 8) {
        xmlBuf = zlib.inflateRawSync(compressed, {
          maxOutputLength: MAX_UNZIPPED_XML_BYTES,
        });
      } else {
        return null;
      }

      const xmlStr = xmlBuf.toString("utf8");
      const withBreaks = xmlStr
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:tab\s*\/>/g, "\t")
        .replace(/<w:br[^>]*\/>/g, "\n");
      const stripped = withBreaks.replace(/<[^>]+>/g, "");
      const decoded = decodeXmlEntities(stripped)
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return decoded.length > 0 ? decoded : null;
    }

    pos += 46 + nameLen + extraLen + commentLen;
  }

  return null;
}

/**
 * Extracción textual básica y segura para PDFs sin compresión compleja.
 * Si el PDF es escaneado o usa fuentes/compresión no extraíbles localmente,
 * retorna null para informar honestamente la limitación sin inventar texto.
 */
function extractBasicTextFromPdfBuffer(buf: Buffer): string | null {
  const latin = buf.toString("latin1");
  const fragments: string[] = [];

  // Buscar literales PDF simples seguidos de operador Tj
  const tjRegex = /\(([^()\\]{3,300})\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(latin)) !== null && fragments.length < 400) {
    const clean = match[1].replace(/[^\x20-\x7e\xA0-\xFF]/g, " ").trim();
    if (clean.length >= 2) fragments.push(clean);
  }

  const joined = fragments.join(" ").replace(/\s+/g, " ").trim();
  return joined.length >= 25 ? joined : null;
}

@Injectable()
export class DocumentTextExtractorService implements IDocumentTextExtractor {
  constructor(
    private readonly documentsManagement: DocumentsManagementService,
  ) {}

  /**
   * Lee el archivo EXCLUSIVAMENTE a través de AUTH-08 (`prepareDownload`),
   * respetando RLS, permisos, verificación SHA-256 en disco y AuditLog.
   */
  async extractAuthorizedText(
    documentId: string,
    ctx: ActiveOrgContext,
    maxChars = 6000,
  ): Promise<ExtractedDocumentText> {
    const download = await this.documentsManagement.prepareDownload(
      documentId,
      undefined,
      ctx,
    );

    const cd = download.contentDisposition || "";
    const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
    const asciiMatch = cd.match(/filename="([^"]+)"/i);
    const filename = utf8Match
      ? decodeURIComponent(utf8Match[1])
      : asciiMatch
        ? asciiMatch[1]
        : `documento-${documentId}`;
    const mimeType = download.mimeType;

    try {
      const isDocx =
        mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        filename.toLowerCase().endsWith(".docx");
      const isPdf =
        mimeType === "application/pdf" ||
        filename.toLowerCase().endsWith(".pdf");

      if (!isDocx && !isPdf) {
        download.stream.destroy();
        return {
          extractedText: null,
          truncated: false,
          limitation: `El documento "${filename}" (${mimeType}) no es un formato textual extraíble localmente; se incluyeron únicamente sus metadatos verificados.`,
        };
      }

      if (download.sizeBytes > MAX_READ_BYTES) {
        download.stream.destroy();
        return {
          extractedText: null,
          truncated: true,
          limitation: `El documento "${filename}" supera el límite de extracción textual local (5 MB); se incluyeron sus metadatos verificados.`,
        };
      }

      const chunks: Buffer[] = [];
      let total = 0;
      await new Promise<void>((resolve, reject) => {
        download.stream.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total <= MAX_READ_BYTES) {
            chunks.push(chunk);
          } else {
            download.stream.destroy();
          }
        });
        download.stream.on("error", reject);
        download.stream.on("end", resolve);
        download.stream.on("close", resolve);
      });

      const buffer = Buffer.concat(chunks);
      const rawText = isDocx
        ? extractTextFromDocxBuffer(buffer)
        : extractBasicTextFromPdfBuffer(buffer);

      if (!rawText) {
        return {
          extractedText: null,
          truncated: false,
          limitation: `El documento "${filename}" no contiene texto extraíble localmente (puede estar escaneado o codificado sin capa de texto); se utilizaron sus metadatos verificados.`,
        };
      }

      if (rawText.length > maxChars) {
        return {
          extractedText: rawText.slice(0, maxChars),
          truncated: true,
          limitation: `El texto extraído de "${filename}" fue acotado a ${maxChars} caracteres por límite de contexto.`,
        };
      }

      return {
        extractedText: rawText,
        truncated: false,
      };
    } catch {
      download.stream.destroy();
      return {
        extractedText: null,
        truncated: false,
        limitation: `No fue posible extraer texto localmente de "${filename}"; se utilizaron sus metadatos verificados.`,
      };
    }
  }
}
