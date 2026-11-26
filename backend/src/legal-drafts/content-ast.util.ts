import { BadRequestException } from "@nestjs/common";
import { LegalDraftDocumentType } from "@prisma/client";

export interface LegalDocMark {
  type: "bold" | "italic" | "underline";
}

export interface LegalDocAttrs {
  level?: 1 | 2 | 3 | 4;
  textAlign?: "left" | "center" | "right" | "justify";
  indent?: number;
  start?: number;
}

export interface LegalDocNode {
  type:
    | "doc"
    | "paragraph"
    | "heading"
    | "text"
    | "hardBreak"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "blockquote"
    | "horizontalRule";
  attrs?: LegalDocAttrs;
  marks?: LegalDocMark[];
  text?: string;
  content?: LegalDocNode[];
}

export interface LegalDocRoot extends LegalDocNode {
  type: "doc";
  content: LegalDocNode[];
}

const ALLOWED_NODE_TYPES = new Set<string>([
  "doc",
  "paragraph",
  "heading",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
]);

const ALLOWED_MARKS = new Set<string>(["bold", "italic", "underline"]);
const ALLOWED_ALIGNMENTS = new Set<string>([
  "left",
  "center",
  "right",
  "justify",
]);

const MAX_DEPTH = 16;
const MAX_NODES = 15000;
const MAX_TEXT_LENGTH = 500_000;

function sanitizeAttrs(
  nodeType: string,
  rawAttrs: unknown,
): LegalDocAttrs | undefined {
  if (rawAttrs === undefined || rawAttrs === null) return undefined;
  if (typeof rawAttrs !== "object" || Array.isArray(rawAttrs)) {
    throw new BadRequestException(
      "Atributos de nodo inválidos en el contenido",
    );
  }

  const attrsObj = rawAttrs as Record<string, unknown>;
  const cleaned: LegalDocAttrs = {};

  for (const [key, value] of Object.entries(attrsObj)) {
    // Bloquear atributos de eventos o esquemas activos explícitamente
    if (
      key.toLowerCase().startsWith("on") ||
      key.toLowerCase() === "src" ||
      key.toLowerCase() === "href" ||
      key.toLowerCase() === "style"
    ) {
      throw new BadRequestException(
        `Atributo prohibido por seguridad en el contenido: ${key}`,
      );
    }

    if (key === "level" && nodeType === "heading") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 4) {
        throw new BadRequestException("Nivel de encabezado inválido (1-4)");
      }
      cleaned.level = n as 1 | 2 | 3 | 4;
    } else if (
      key === "textAlign" &&
      (nodeType === "paragraph" || nodeType === "heading")
    ) {
      if (value !== null && value !== undefined) {
        const align = String(value);
        if (!ALLOWED_ALIGNMENTS.has(align)) {
          throw new BadRequestException(`Alineación inválida: ${align}`);
        }
        cleaned.textAlign = align as LegalDocAttrs["textAlign"];
      }
    } else if (
      key === "indent" &&
      (nodeType === "paragraph" || nodeType === "heading")
    ) {
      const ind = Number(value);
      if (!Number.isInteger(ind) || ind < 0 || ind > 6) {
        throw new BadRequestException("Nivel de sangría inválido (0-6)");
      }
      if (ind > 0) cleaned.indent = ind;
    } else if (key === "start" && nodeType === "orderedList") {
      const st = Number(value);
      if (!Number.isInteger(st) || st < 1 || st > 1000) {
        throw new BadRequestException("Inicio de lista numerada inválido");
      }
      cleaned.start = st;
    }
    // Ignorar atributos benignos de layout como `dir: null`
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function sanitizeMarks(rawMarks: unknown): LegalDocMark[] | undefined {
  if (rawMarks === undefined || rawMarks === null) return undefined;
  if (!Array.isArray(rawMarks)) {
    throw new BadRequestException("Formato de marcas inválido");
  }

  const result: LegalDocMark[] = [];
  const seen = new Set<string>();
  for (const m of rawMarks) {
    if (!m || typeof m !== "object" || Array.isArray(m)) {
      throw new BadRequestException("Marca de formato inválida");
    }
    const markType = (m as Record<string, unknown>).type;
    if (typeof markType !== "string" || !ALLOWED_MARKS.has(markType)) {
      throw new BadRequestException(
        `Marca de formato no permitida: ${String(markType)}`,
      );
    }
    if (!seen.has(markType)) {
      seen.add(markType);
      result.push({ type: markType as LegalDocMark["type"] });
    }
  }
  return result.length > 0 ? result : undefined;
}

function sanitizeNode(
  raw: unknown,
  depth: number,
  counter: { nodes: number; chars: number },
): LegalDocNode {
  if (depth > MAX_DEPTH) {
    throw new BadRequestException(
      "Profundidad máxima de estructura documental excedida",
    );
  }
  counter.nodes += 1;
  if (counter.nodes > MAX_NODES) {
    throw new BadRequestException("El contenido excede el límite de nodos");
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BadRequestException("Nodo documental inválido");
  }

  const obj = raw as Record<string, unknown>;
  const nodeType = obj.type;
  if (typeof nodeType !== "string" || !ALLOWED_NODE_TYPES.has(nodeType)) {
    throw new BadRequestException(
      `Tipo de nodo no permitido en el contenido jurídico: ${String(nodeType)}`,
    );
  }

  const sanitized: LegalDocNode = {
    type: nodeType as LegalDocNode["type"],
  };

  const attrs = sanitizeAttrs(nodeType, obj.attrs);
  if (attrs) sanitized.attrs = attrs;

  if (nodeType === "text") {
    if (typeof obj.text !== "string") {
      throw new BadRequestException("Nodo de texto sin propiedad text válida");
    }
    // Bloquear null bytes
    const cleanText = obj.text.replace(/\0/g, "");
    counter.chars += cleanText.length;
    if (counter.chars > MAX_TEXT_LENGTH) {
      throw new BadRequestException(
        "El contenido supera el límite máximo de caracteres permitido",
      );
    }
    sanitized.text = cleanText;
    const marks = sanitizeMarks(obj.marks);
    if (marks) sanitized.marks = marks;
    return sanitized;
  }

  if (obj.content !== undefined) {
    if (!Array.isArray(obj.content)) {
      throw new BadRequestException("La propiedad content debe ser un arreglo");
    }
    sanitized.content = obj.content.map((child) =>
      sanitizeNode(child, depth + 1, counter),
    );
  }

  return sanitized;
}

export function extractPlainTextFromAst(doc: LegalDocNode): string {
  const lines: string[] = [];

  const collectInline = (nodes?: LegalDocNode[]): string => {
    if (!nodes) return "";
    let out = "";
    for (const n of nodes) {
      if (n.type === "text") {
        out += n.text || "";
      } else if (n.type === "hardBreak") {
        out += "\n";
      } else if (n.content) {
        out += collectInline(n.content);
      }
    }
    return out;
  };

  const walkBlock = (nodes?: LegalDocNode[], indent = "") => {
    if (!nodes) return;
    for (const node of nodes) {
      switch (node.type) {
        case "heading":
        case "paragraph": {
          lines.push(`${indent}${collectInline(node.content).trimEnd()}`);
          break;
        }
        case "blockquote": {
          walkBlock(node.content, `${indent}> `);
          break;
        }
        case "bulletList": {
          for (const item of node.content || []) {
            const text = collectInline(item.content).trim();
            lines.push(`${indent}- ${text}`);
          }
          break;
        }
        case "orderedList": {
          const start = node.attrs?.start ?? 1;
          (node.content || []).forEach((item, idx) => {
            const text = collectInline(item.content).trim();
            lines.push(`${indent}${start + idx}. ${text}`);
          });
          break;
        }
        case "horizontalRule": {
          lines.push("---");
          break;
        }
        default: {
          if (node.content) walkBlock(node.content, indent);
          break;
        }
      }
    }
  };

  walkBlock(doc.content);
  return lines.join("\n").trim();
}

/**
 * Valida y sanitiza estrictamente el AST TipTap/ProseMirror JSON.
 * Rechaza scripts, iframes, objetos embebidos, atributos on* y nodos desconocidos.
 */
export function validateAndSanitizeLegalContent(raw: unknown): {
  content: LegalDocRoot;
  plainText: string;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BadRequestException(
      "El contenido del escrito debe ser un documento JSON estructurado válido",
    );
  }

  const rootObj = raw as Record<string, unknown>;
  if (rootObj.type !== "doc") {
    throw new BadRequestException(
      'El nodo raíz del contenido estructurado debe tener type: "doc"',
    );
  }

  const counter = { nodes: 0, chars: 0 };
  const sanitized = sanitizeNode(raw, 0, counter) as LegalDocRoot;
  if (!Array.isArray(sanitized.content) || sanitized.content.length === 0) {
    sanitized.content = [{ type: "paragraph", content: [] }];
  }

  const plainText = extractPlainTextFromAst(sanitized);
  return { content: sanitized, plainText };
}

/**
 * Genera una estructura inicial jurídica editable sin inventar datos desconocidos.
 * Solo completa datos verificados del expediente; los desconocidos quedan como marcadores pendientes.
 */
export function buildDefaultLegalStructure(params: {
  title: string;
  documentType: LegalDraftDocumentType;
  caratula?: string | null;
  numeroExpediente?: string | null;
  juzgado?: string | null;
}): LegalDocRoot {
  const expIdent = [
    params.caratula
      ? `Autos: "${params.caratula}"`
      : 'Autos: "[COMPLETAR CARÁTULA]"',
    params.numeroExpediente
      ? `Expte. N°: ${params.numeroExpediente}`
      : "Expte. N°: [COMPLETAR NÚMERO DE EXPEDIENTE]",
    params.juzgado
      ? `Tribunal: ${params.juzgado}`
      : "Tribunal: [COMPLETAR TRIBUNAL / JUZGADO]",
  ].join(" — ");

  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2, textAlign: "center" },
        content: [{ type: "text", text: params.title.toUpperCase() }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", marks: [{ type: "italic" }], text: expIdent },
        ],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "SEÑOR/A JUEZ:" },
        ],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [
          {
            type: "text",
            text: "[COMPLETAR COMPARECENCIA, CARÁCTER, DOMICILIO REAL Y DOMICILIO PROCESAL CONSTITUIDO], a V.S. respetuosamente me presento y digo:",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3, textAlign: "left" },
        content: [{ type: "text", text: "I. OBJETO" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [{ type: "text", text: "[COMPLETAR OBJETO DEL ESCRITO]." }],
      },
      {
        type: "heading",
        attrs: { level: 3, textAlign: "left" },
        content: [{ type: "text", text: "II. HECHOS" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [{ type: "text", text: "[COMPLETAR HECHOS VERIFICADOS]." }],
      },
      {
        type: "heading",
        attrs: { level: 3, textAlign: "left" },
        content: [{ type: "text", text: "III. DERECHO" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [
          {
            type: "text",
            text: "[COMPLETAR FUNDAMENTOS DE DERECHO VERIFICADOS POR EL PROFESIONAL].",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3, textAlign: "left" },
        content: [{ type: "text", text: "IV. PRUEBA" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [
          {
            type: "text",
            text: "[COMPLETAR OFRECIMIENTO DE PRUEBA O ELIMINAR SI NO CORRESPONDE].",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3, textAlign: "left" },
        content: [{ type: "text", text: "V. PETITORIO" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [{ type: "text", text: "[COMPLETAR PETITORIO]." }],
      },
      { type: "horizontalRule" },
      {
        type: "paragraph",
        attrs: { textAlign: "right" },
        content: [
          {
            type: "text",
            text: "Proveer de conformidad, SERÁ JUSTICIA. — [COMPLETAR FIRMA Y MATRÍCULA PROFESIONAL]",
          },
        ],
      },
    ],
  };
}
