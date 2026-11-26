import { LegalDraftCategory, LegalDraftDocumentType } from "@prisma/client";
import { LegalDocNode, LegalDocRoot } from "./content-ast.util";

export interface LegalDocumentCatalogItem {
  category: LegalDraftCategory;
  documentType: LegalDraftDocumentType;
  label: string;
  baseInstructions: string;
  caseOptional: boolean;
}

export const JUDICIAL_CATALOG: ReadonlyArray<LegalDocumentCatalogItem> = [
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.DEMANDA,
    label: "Demanda",
    baseInstructions:
      "Demanda judicial completa con estructura formal argentina (encabezado, comparecencia, objeto, hechos, derecho, prueba y petitorio).",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.CONTESTACION_DEMANDA,
    label: "Contestación de demanda",
    baseInstructions:
      "Negativa circunstanciada de hechos no reconocidos, defensas procesales y de fondo, y ofrecimiento de prueba.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.EXCEPCION,
    label: "Excepción",
    baseInstructions:
      "Excepción procesal con fundamentos de hecho y derecho verificables y petitorio concreto.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.APERTURA_PRUEBA,
    label: "Apertura a prueba",
    baseInstructions:
      "Solicitud de apertura a prueba con detalle de hechos controvertidos y ofrecimiento de medios probatorios.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.ALEGATO,
    label: "Alegato",
    baseInstructions:
      "Valoración ordenada de la prueba producida en autos y fundamentación jurídica concluyente.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.APELACION,
    label: "Apelación",
    baseInstructions:
      "Expresión de agravios crítica, concreta y razonada respecto de la resolución recurrida y petitorio de revocación.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.CONTESTACION_TRASLADO,
    label: "Contesta traslado",
    baseInstructions:
      "Respuesta a traslado conferido con sustento fáctico y jurídico basado exclusivamente en antecedentes verificados.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.PRONTO_DESPACHO,
    label: "Pronto despacho",
    baseInstructions:
      "Solicitud respetuosa de pronto despacho al juzgado referenciando el estado actual y actuaciones pendientes verificadas.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.MEDIDA_CAUTELAR,
    label: "Medida cautelar",
    baseInstructions:
      "Solicitud urgente de medida cautelar acreditando verosimilitud del derecho, peligro en la demora y contracautela.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.ESCRITO_LIBRE,
    label: "Escrito libre",
    baseInstructions:
      "Redacción libre de escrito judicial conforme a las instrucciones específicas del profesional.",
    caseOptional: true,
  },
];

export const CONTRACT_CATALOG: ReadonlyArray<LegalDocumentCatalogItem> = [
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_LOCACION,
    label: "Contrato de locación",
    baseInstructions:
      "Locación de inmueble con cláusulas típicas del tipo (partes, objeto, plazo, precio, destino, obligaciones, garantía y jurisdicción).",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_SERVICIOS,
    label: "Contrato de servicios",
    baseInstructions:
      "Prestación de servicios profesionales o comerciales con alcance, niveles de servicio, honorarios, confidencialidad y rescisión.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_NDA,
    label: "Confidencialidad (NDA)",
    baseInstructions:
      "Acuerdo de confidencialidad bilateral o unilateral con definición de información protegida, exclusiones, plazo y consecuencias de incumplimiento.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_COMPRAVENTA,
    label: "Contrato de compraventa",
    baseInstructions:
      "Compraventa de bienes con individualización del objeto, precio, modalidad de entrega, saneamiento y garantía.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_MUTUO,
    label: "Contrato de mutuo",
    baseInstructions:
      "Préstamo de dinero con capital, moneda, intereses convenidos, cronograma de devolución y cláusulas de mora.",
    caseOptional: true,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.OTRO_CONTRATO,
    label: "Otro contrato",
    baseInstructions:
      "Redacción libre de acuerdo contractual según las instrucciones específicas del profesional.",
    caseOptional: true,
  },
];

export const FULL_DOCUMENT_CATALOG = [...JUDICIAL_CATALOG, ...CONTRACT_CATALOG];

export function findCatalogItem(
  documentType: LegalDraftDocumentType,
): LegalDocumentCatalogItem {
  const found = FULL_DOCUMENT_CATALOG.find(
    (item) => item.documentType === documentType,
  );
  if (found) return found;

  const isContract =
    String(documentType).startsWith("CONTRATO_") ||
    documentType === LegalDraftDocumentType.OTRO_CONTRATO;
  return {
    category: isContract
      ? LegalDraftCategory.CONTRATO
      : LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType,
    label: documentType,
    baseInstructions:
      "Redacción jurídica estructurada basada estrictamente en los datos verificados provistos por el profesional.",
    caseOptional: true,
  };
}

/**
 * Resuelve variables {{nombre}} dentro de un AST TipTap usando exclusivamente
 * datos verificados; las variables faltantes se marcan explícitamente como
 * [DATO PENDIENTE DE CONFIRMAR: nombre] sin inventar valores.
 */
export function resolveTemplateVariablesInAst(
  ast: LegalDocRoot,
  verifiedValues: Record<string, string | null | undefined>,
): { content: LegalDocRoot; unresolvedVariables: string[] } {
  const unresolved = new Set<string>();
  const varRegex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

  const transformNode = (node: LegalDocNode): LegalDocNode => {
    const clone: LegalDocNode = { ...node };
    if (node.type === "text" && typeof node.text === "string") {
      clone.text = node.text.replace(varRegex, (_match, key: string) => {
        const val = verifiedValues[key]?.trim();
        if (val) return val;
        unresolved.add(key);
        return `[DATO PENDIENTE DE CONFIRMAR: ${key}]`;
      });
    }
    if (Array.isArray(node.content)) {
      clone.content = node.content.map(transformNode);
    }
    return clone;
  };

  return {
    content: transformNode(ast) as LegalDocRoot,
    unresolvedVariables: Array.from(unresolved),
  };
}
