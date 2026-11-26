import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import PDFDocument = require("pdfkit");
import { LegalDocNode, LegalDocRoot } from "./content-ast.util";

export interface NormalizedExportOptions {
  fontFamily: string;
  fontSizePt: number;
  lineSpacing: number;
  marginTopCm: number;
  marginBottomCm: number;
  marginLeftCm: number;
  marginRightCm: number;
  headerText: string;
  footerText: string;
  includePageNumbers: boolean;
}

export interface ExportContextMetadata {
  title: string;
  versionNumber: number;
  caseNumber?: string | null;
  caratula?: string | null;
  courtName?: string | null;
}

const CM_TO_TWIPS = 567; // 1 cm ≈ 566.93 twips
const CM_TO_PT = 28.3465;

export function normalizeExportOptions(
  raw?: Partial<NormalizedExportOptions>,
): NormalizedExportOptions {
  const clamp = (val: unknown, fallback: number, min: number, max: number) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  };

  return {
    fontFamily:
      typeof raw?.fontFamily === "string" && raw.fontFamily.trim().length > 0
        ? raw.fontFamily.trim().slice(0, 60)
        : "Times New Roman",
    fontSizePt: clamp(raw?.fontSizePt, 12, 9, 16),
    lineSpacing: clamp(raw?.lineSpacing, 1.5, 1.0, 2.5),
    marginTopCm: clamp(raw?.marginTopCm, 2.5, 1.0, 5.0),
    marginBottomCm: clamp(raw?.marginBottomCm, 2.5, 1.0, 5.0),
    marginLeftCm: clamp(raw?.marginLeftCm, 3.0, 1.0, 5.0),
    marginRightCm: clamp(raw?.marginRightCm, 2.5, 1.0, 5.0),
    headerText:
      typeof raw?.headerText === "string"
        ? raw.headerText.trim().slice(0, 180)
        : "",
    footerText:
      typeof raw?.footerText === "string"
        ? raw.footerText.trim().slice(0, 180)
        : "",
    includePageNumbers: raw?.includePageNumbers !== false,
  };
}

export function hashExportOptions(options: NormalizedExportOptions): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(options))
    .digest("hex");
}

function mapDocxAlignment(
  align?: string,
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (align) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.LEFT;
  }
}

function mapPdfFont(family: string, bold: boolean, italic: boolean): string {
  const lower = family.toLowerCase();
  const isSans =
    lower.includes("arial") ||
    lower.includes("helvetica") ||
    lower.includes("inter") ||
    lower.includes("calibri");

  if (isSans) {
    if (bold && italic) return "Helvetica-BoldOblique";
    if (bold) return "Helvetica-Bold";
    if (italic) return "Helvetica-Oblique";
    return "Helvetica";
  }

  if (bold && italic) return "Times-BoldItalic";
  if (bold) return "Times-Bold";
  if (italic) return "Times-Italic";
  return "Times-Roman";
}

interface FlatTextSpan {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function collectInlineSpans(nodes?: LegalDocNode[]): FlatTextSpan[] {
  if (!nodes) return [];
  const spans: FlatTextSpan[] = [];

  for (const node of nodes) {
    if (node.type === "text" && node.text) {
      const markSet = new Set((node.marks || []).map((m) => m.type));
      spans.push({
        text: node.text,
        bold: markSet.has("bold"),
        italic: markSet.has("italic"),
        underline: markSet.has("underline"),
      });
    } else if (node.type === "hardBreak") {
      spans.push({ text: "\n", bold: false, italic: false, underline: false });
    } else if (node.content) {
      spans.push(...collectInlineSpans(node.content));
    }
  }

  return spans;
}

@Injectable()
export class LegalDraftExportGeneratorService {
  /**
   * Genera un archivo OOXML (.docx) real a partir del AST estructurado de una versión inmutable.
   */
  async generateDocxBuffer(
    ast: LegalDocRoot,
    meta: ExportContextMetadata,
    options: NormalizedExportOptions,
  ): Promise<Buffer> {
    const paragraphs: Paragraph[] = [];
    const baseSizeHalfPt = Math.round(options.fontSizePt * 2);
    const lineTwips = Math.round(options.lineSpacing * 240);

    const buildRuns = (
      spans: FlatTextSpan[],
      overrideSizeHalfPt?: number,
      forceBold = false,
    ): TextRun[] => {
      if (spans.length === 0) {
        return [
          new TextRun({
            text: "",
            font: options.fontFamily,
            size: overrideSizeHalfPt ?? baseSizeHalfPt,
          }),
        ];
      }

      const runs: TextRun[] = [];
      for (const sp of spans) {
        const parts = sp.text.split("\n");
        parts.forEach((part, idx) => {
          runs.push(
            new TextRun({
              text: part,
              font: options.fontFamily,
              size: overrideSizeHalfPt ?? baseSizeHalfPt,
              bold: forceBold || sp.bold,
              italics: sp.italic,
              underline: sp.underline ? {} : undefined,
              break: idx > 0 ? 1 : undefined,
            }),
          );
        });
      }
      return runs;
    };

    const appendBlocks = (nodes?: LegalDocNode[], extraIndentLevel = 0) => {
      if (!nodes) return;
      for (const node of nodes) {
        const nodeIndent = (node.attrs?.indent ?? 0) + extraIndentLevel;
        const leftIndentTwips = nodeIndent * 720;

        switch (node.type) {
          case "heading": {
            const lvl = node.attrs?.level ?? 2;
            const headingSize =
              lvl === 1
                ? baseSizeHalfPt + 8
                : lvl === 2
                  ? baseSizeHalfPt + 4
                  : baseSizeHalfPt + 2;
            const headingEnum =
              lvl === 1
                ? HeadingLevel.HEADING_1
                : lvl === 2
                  ? HeadingLevel.HEADING_2
                  : HeadingLevel.HEADING_3;

            paragraphs.push(
              new Paragraph({
                heading: headingEnum,
                alignment: mapDocxAlignment(node.attrs?.textAlign),
                indent: leftIndentTwips ? { left: leftIndentTwips } : undefined,
                spacing: { before: 200, after: 120, line: lineTwips },
                children: buildRuns(
                  collectInlineSpans(node.content),
                  headingSize,
                  true,
                ),
              }),
            );
            break;
          }

          case "paragraph": {
            paragraphs.push(
              new Paragraph({
                alignment: mapDocxAlignment(node.attrs?.textAlign),
                indent: leftIndentTwips ? { left: leftIndentTwips } : undefined,
                spacing: { after: 120, line: lineTwips },
                children: buildRuns(collectInlineSpans(node.content)),
              }),
            );
            break;
          }

          case "blockquote": {
            appendBlocks(node.content, extraIndentLevel + 1);
            break;
          }

          case "bulletList": {
            for (const item of node.content || []) {
              const spans = collectInlineSpans(item.content);
              paragraphs.push(
                new Paragraph({
                  indent: {
                    left: (extraIndentLevel + 1) * 720,
                    hanging: 360,
                  },
                  spacing: { after: 80, line: lineTwips },
                  children: [
                    new TextRun({
                      text: "• ",
                      font: options.fontFamily,
                      size: baseSizeHalfPt,
                    }),
                    ...buildRuns(spans),
                  ],
                }),
              );
            }
            break;
          }

          case "orderedList": {
            const start = node.attrs?.start ?? 1;
            (node.content || []).forEach((item, idx) => {
              const spans = collectInlineSpans(item.content);
              paragraphs.push(
                new Paragraph({
                  indent: {
                    left: (extraIndentLevel + 1) * 720,
                    hanging: 360,
                  },
                  spacing: { after: 80, line: lineTwips },
                  children: [
                    new TextRun({
                      text: `${start + idx}. `,
                      font: options.fontFamily,
                      size: baseSizeHalfPt,
                      bold: true,
                    }),
                    ...buildRuns(spans),
                  ],
                }),
              );
            });
            break;
          }

          case "horizontalRule": {
            paragraphs.push(
              new Paragraph({
                border: {
                  bottom: {
                    color: "666666",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6,
                  },
                },
                spacing: { before: 120, after: 120 },
                children: [],
              }),
            );
            break;
          }

          default: {
            if (node.content) appendBlocks(node.content, extraIndentLevel);
            break;
          }
        }
      }
    };

    appendBlocks(ast.content);

    const headerSummary =
      options.headerText ||
      [
        meta.title,
        meta.caseNumber ? `Expte. ${meta.caseNumber}` : null,
        `v${meta.versionNumber}`,
      ]
        .filter(Boolean)
        .join(" — ");

    const footerChildren: TextRun[] = [];
    if (options.footerText) {
      footerChildren.push(
        new TextRun({
          text: `${options.footerText}   `,
          font: options.fontFamily,
          size: 18,
          color: "666666",
        }),
      );
    }
    if (options.includePageNumbers) {
      footerChildren.push(
        new TextRun({
          text: "Página ",
          font: options.fontFamily,
          size: 18,
          color: "666666",
        }),
        new TextRun({
          children: [PageNumber.CURRENT],
          font: options.fontFamily,
          size: 18,
          color: "666666",
        }),
        new TextRun({
          text: " de ",
          font: options.fontFamily,
          size: 18,
          color: "666666",
        }),
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          font: options.fontFamily,
          size: 18,
          color: "666666",
        }),
      );
    }

    const doc = new DocxDocument({
      title: meta.title,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: Math.round(options.marginTopCm * CM_TO_TWIPS),
                bottom: Math.round(options.marginBottomCm * CM_TO_TWIPS),
                left: Math.round(options.marginLeftCm * CM_TO_TWIPS),
                right: Math.round(options.marginRightCm * CM_TO_TWIPS),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: headerSummary,
                      font: options.fontFamily,
                      size: 18,
                      color: "666666",
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: footerChildren,
                }),
              ],
            }),
          },
          children: paragraphs,
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  /**
   * Genera un archivo PDF real directamente desde el mismo AST estructurado mediante PDFKit.
   * Nota normativa: al ser un motor independiente de Word/DOCX, la paginación exacta puede
   * variar levemente respecto del DOCX manteniendo el 100% del contenido de la versión.
   */
  async generatePdfBuffer(
    ast: LegalDocRoot,
    meta: ExportContextMetadata,
    options: NormalizedExportOptions,
  ): Promise<Buffer> {
    const marginTop = Math.round(options.marginTopCm * CM_TO_PT);
    const marginBottom = Math.round(options.marginBottomCm * CM_TO_PT);
    const marginLeft = Math.round(options.marginLeftCm * CM_TO_PT);
    const marginRight = Math.round(options.marginRightCm * CM_TO_PT);
    const lineGap = Math.max(
      1,
      Math.round((options.lineSpacing - 1) * options.fontSizePt),
    );

    const headerSummary =
      options.headerText ||
      [
        meta.title,
        meta.caseNumber ? `Expte. ${meta.caseNumber}` : null,
        `v${meta.versionNumber}`,
      ]
        .filter(Boolean)
        .join(" — ");

    return new Promise<Buffer>((resolve, reject) => {
      const pdf = new PDFDocument({
        size: "A4",
        bufferPages: true,
        margins: {
          top: marginTop,
          bottom: marginBottom,
          left: marginLeft,
          right: marginRight,
        },
        info: {
          Title: meta.title,
          Subject: meta.caratula || meta.caseNumber || "Escrito Jurídico",
          Creator: "Abogados-Law AUTH-09",
        },
      });

      const chunks: Buffer[] = [];
      pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdf.on("error", reject);
      pdf.on("end", () => resolve(Buffer.concat(chunks)));

      const contentWidth = pdf.page.width - marginLeft - marginRight;

      const renderSpans = (
        spans: FlatTextSpan[],
        fontSize: number,
        align: "left" | "center" | "right" | "justify",
        indentPt: number,
        forceBold = false,
      ) => {
        const textX = marginLeft + indentPt;
        const availWidth = Math.max(100, contentWidth - indentPt);

        if (spans.length === 0) {
          pdf.moveDown(0.5);
          return;
        }

        // Si todos los spans comparten estilo, renderizar en un solo bloque (mejor justificación)
        const first = spans[0];
        const sameStyle = spans.every(
          (s) =>
            s.bold === first.bold &&
            s.italic === first.italic &&
            s.underline === first.underline,
        );

        if (sameStyle) {
          pdf
            .font(
              mapPdfFont(
                options.fontFamily,
                forceBold || first.bold,
                first.italic,
              ),
            )
            .fontSize(fontSize)
            .text(spans.map((s) => s.text).join(""), textX, pdf.y, {
              width: availWidth,
              align,
              lineGap,
              underline: first.underline,
            });
          return;
        }

        spans.forEach((sp, idx) => {
          const isLast = idx === spans.length - 1;
          pdf
            .font(
              mapPdfFont(options.fontFamily, forceBold || sp.bold, sp.italic),
            )
            .fontSize(fontSize)
            .text(
              sp.text,
              idx === 0 ? textX : undefined,
              idx === 0 ? pdf.y : undefined,
              {
                width: availWidth,
                align,
                lineGap,
                underline: sp.underline,
                continued: !isLast,
              },
            );
        });
      };

      const renderBlocks = (nodes?: LegalDocNode[], extraIndentLevel = 0) => {
        if (!nodes) return;
        for (const node of nodes) {
          const nodeIndent = (node.attrs?.indent ?? 0) + extraIndentLevel;
          const indentPt = nodeIndent * 24;
          const align = node.attrs?.textAlign || "left";

          switch (node.type) {
            case "heading": {
              const lvl = node.attrs?.level ?? 2;
              const size =
                lvl === 1
                  ? options.fontSizePt + 4
                  : lvl === 2
                    ? options.fontSizePt + 2
                    : options.fontSizePt + 1;
              pdf.moveDown(0.4);
              renderSpans(
                collectInlineSpans(node.content),
                size,
                align,
                indentPt,
                true,
              );
              pdf.moveDown(0.3);
              break;
            }

            case "paragraph": {
              renderSpans(
                collectInlineSpans(node.content),
                options.fontSizePt,
                align,
                indentPt,
                false,
              );
              pdf.moveDown(0.4);
              break;
            }

            case "blockquote": {
              renderBlocks(node.content, extraIndentLevel + 1);
              break;
            }

            case "bulletList": {
              for (const item of node.content || []) {
                const spans = [
                  {
                    text: "• ",
                    bold: false,
                    italic: false,
                    underline: false,
                  },
                  ...collectInlineSpans(item.content),
                ];
                renderSpans(
                  spans,
                  options.fontSizePt,
                  "left",
                  (extraIndentLevel + 1) * 24,
                );
                pdf.moveDown(0.2);
              }
              pdf.moveDown(0.2);
              break;
            }

            case "orderedList": {
              const start = node.attrs?.start ?? 1;
              (node.content || []).forEach((item, idx) => {
                const spans = [
                  {
                    text: `${start + idx}. `,
                    bold: true,
                    italic: false,
                    underline: false,
                  },
                  ...collectInlineSpans(item.content),
                ];
                renderSpans(
                  spans,
                  options.fontSizePt,
                  "left",
                  (extraIndentLevel + 1) * 24,
                );
                pdf.moveDown(0.2);
              });
              pdf.moveDown(0.2);
              break;
            }

            case "horizontalRule": {
              const y = pdf.y + 6;
              pdf
                .moveTo(marginLeft, y)
                .lineTo(pdf.page.width - marginRight, y)
                .lineWidth(0.75)
                .strokeColor("#666666")
                .stroke()
                .strokeColor("#000000");
              pdf.moveDown(0.8);
              break;
            }

            default: {
              if (node.content) renderBlocks(node.content, extraIndentLevel);
              break;
            }
          }
        }
      };

      renderBlocks(ast.content);

      // Pintar encabezado, pie y numeración de páginas en todas las páginas
      const range = pdf.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        pdf.switchToPage(i);
        const pageNum = i - range.start + 1;

        pdf
          .font(mapPdfFont(options.fontFamily, false, false))
          .fontSize(8.5)
          .fillColor("#555555");

        if (headerSummary) {
          pdf.text(headerSummary, marginLeft, Math.max(18, marginTop - 28), {
            width: contentWidth,
            align: "right",
            lineBreak: false,
          });
        }

        const footerParts: string[] = [];
        if (options.footerText) footerParts.push(options.footerText);
        if (options.includePageNumbers) {
          footerParts.push(`Página ${pageNum} de ${range.count}`);
        }
        if (footerParts.length > 0) {
          pdf.text(
            footerParts.join("   |   "),
            marginLeft,
            pdf.page.height - Math.max(24, marginBottom - 16),
            {
              width: contentWidth,
              align: "right",
              lineBreak: false,
            },
          );
        }
        pdf.fillColor("#000000");
      }

      pdf.end();
    });
  }
}
