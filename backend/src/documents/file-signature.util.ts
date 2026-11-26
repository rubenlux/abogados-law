import { BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_FILENAME_LENGTH = 255;

export interface ValidatedFileMetadata {
  originalFilename: string;
  detectedMimeType: string;
  extension: string;
}

const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".doc": "application/msword",
  ".xls": "application/vnd.ms-excel",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function validateOriginalFilename(rawName: string): {
  sanitizedName: string;
  extension: string;
} {
  if (!rawName || typeof rawName !== "string") {
    throw new BadRequestException("Nombre de archivo inválido");
  }
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.length > MAX_FILENAME_LENGTH) {
    throw new BadRequestException(
      `El nombre de archivo debe tener entre 1 y ${MAX_FILENAME_LENGTH} caracteres`,
    );
  }
  // Rechazar traversal, separadores de ruta, null bytes y caracteres de control
  if (
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0") ||
    /[\x00-\x1f\x7f]/.test(trimmed)
  ) {
    throw new BadRequestException(
      "Nombre de archivo malicioso o con secuencia de ruta prohibida",
    );
  }

  const ext = path.extname(trimmed).toLowerCase();
  if (!ext || !EXTENSION_TO_MIME[ext]) {
    throw new BadRequestException(
      `Extensión de archivo no permitida (${ext || "sin extensión"}). Permitidas: PDF, DOCX, DOC, XLSX, XLS, PNG, JPG/JPEG`,
    );
  }

  return { sanitizedName: trimmed, extension: ext };
}

function startsWithBytes(buf: Buffer, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

function detectBlockedExecutableOrActiveContent(head: Buffer): boolean {
  // PE/EXE ("MZ"), ELF ("\x7fELF"), Shebang ("#!"), Mach-O
  if (startsWithBytes(head, [0x4d, 0x5a])) return true;
  if (startsWithBytes(head, [0x7f, 0x45, 0x4c, 0x46])) return true;
  if (startsWithBytes(head, [0x23, 0x21])) return true;
  if (
    startsWithBytes(head, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWithBytes(head, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWithBytes(head, [0xcf, 0xfa, 0xed, 0xfe])
  ) {
    return true;
  }

  const headText = head
    .subarray(0, Math.min(head.length, 512))
    .toString("utf8")
    .trimStart()
    .toLowerCase();

  if (
    headText.startsWith("<!doctype html") ||
    headText.startsWith("<html") ||
    headText.startsWith("<script") ||
    headText.startsWith("<svg") ||
    headText.includes("<script") ||
    headText.includes("<svg")
  ) {
    return true;
  }

  return false;
}

/**
 * Inspecciona el archivo físico por magic bytes + coherencia con extensión permitida.
 * Nunca confía en el MIME ni en la extensión declarados por el navegador.
 */
export async function inspectAndValidateUploadedFile(
  filePath: string,
  originalFilename: string,
  sizeBytes: number,
): Promise<ValidatedFileMetadata> {
  if (!sizeBytes || sizeBytes <= 0) {
    throw new BadRequestException("No se permiten archivos vacíos");
  }
  if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    throw new BadRequestException(
      "El archivo supera el tamaño máximo permitido de 25 MB",
    );
  }

  const { sanitizedName, extension } =
    validateOriginalFilename(originalFilename);

  const fh = await fs.promises.open(filePath, "r");
  let head: Buffer;
  try {
    const readLen = Math.min(sizeBytes, 8192);
    head = Buffer.alloc(readLen);
    await fh.read(head, 0, readLen, 0);
  } finally {
    await fh.close();
  }

  if (detectBlockedExecutableOrActiveContent(head)) {
    throw new BadRequestException(
      "Formato de archivo bloqueado por seguridad (ejecutable o contenido activo)",
    );
  }

  const isPdf = startsWithBytes(head, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  const isPng = startsWithBytes(
    head,
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  const isJpeg = startsWithBytes(head, [0xff, 0xd8, 0xff]);
  const isOle2 = startsWithBytes(
    head,
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  );
  const isZip = startsWithBytes(head, [0x50, 0x4b, 0x03, 0x04]);

  let matched = false;
  if (extension === ".pdf" && isPdf) matched = true;
  else if (extension === ".png" && isPng) matched = true;
  else if ((extension === ".jpg" || extension === ".jpeg") && isJpeg)
    matched = true;
  else if ((extension === ".doc" || extension === ".xls") && isOle2)
    matched = true;
  else if (extension === ".docx" && isZip) {
    const str = head.toString("latin1");
    if (str.includes("[Content_Types].xml") || str.includes("word/")) {
      matched = true;
    }
  } else if (extension === ".xlsx" && isZip) {
    const str = head.toString("latin1");
    if (str.includes("[Content_Types].xml") || str.includes("xl/")) {
      matched = true;
    }
  }

  if (!matched) {
    throw new BadRequestException(
      "El contenido real del archivo no coincide con la extensión o tipo MIME permitido",
    );
  }

  return {
    originalFilename: sanitizedName,
    detectedMimeType: EXTENSION_TO_MIME[extension],
    extension,
  };
}

export function buildSafeContentDisposition(filename: string): string {
  const safeAscii = filename
    .replace(/["\\\r\n;]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_");
  const encodedUtf8 = encodeURIComponent(filename);
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`;
}
