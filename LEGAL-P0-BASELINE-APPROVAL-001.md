# LEGAL-P0-BASELINE-APPROVAL-001
## ACTA DE APROBACIÓN FORMAL DEL BASELINE DOCUMENTAL v1.2.1

| Campo | Valor |
|---|---|
| Proyecto | Abogados-Law |
| Programa | P0 — Reparación de la base jurídica |
| Expediente | LEGAL-P0-START-001 |
| Baseline | v1.2.1 |
| Auditoría independiente | LEGAL-P0-V1.2.1-CLOSURE-AUDIT-001 |
| Dictamen de auditoría | APTO_CON_OBSERVACIONES |
| Decisión | APROBADO CON OBSERVACIONES ACEPTADAS |
| Fecha | 25/11/2026 |

### 1. Resolución

Se aprueba formalmente el baseline documental v1.2.1 del programa P0 de Abogados-Law, tomando como fundamento:

- La reconciliación documental de las seis especificaciones principales.
- La micro-enmienda documental v1.2.1.
- La auditoría independiente de cierre LEGAL-P0-V1.2.1-CLOSURE-AUDIT-001.
- La verificación de resolución de los ocho hallazgos originales P0-FBA-001 a P0-FBA-008.
- La conformidad de los doce controles de coherencia documental.

La aprobación se emite con aceptación expresa de las seis observaciones nuevas identificadas por la auditoría independiente.

### 2. Observaciones aceptadas

| ID | Observación | Tratamiento aceptado |
|---|---|---|
| P0-V121-AUD-001 | Versiones anteriores de los documentos no recuperables íntegramente desde Git | Se acepta la limitación histórica. El baseline v1.2.1 será preservado mediante versionado Git dedicado, sin reconstruir artificialmente versiones anteriores. |
| P0-V121-AUD-002 | Referencia histórica a la cuarentena del script hasta P0-E | Se acepta como referencia histórica. Prevalece la regla vigente: cuarentena fail-closed en el primer paso técnico de P0-B. |
| P0-V121-AUD-003 | Diferencia de redacción sobre inspección ZIP InfoLEG | Prevalece el requisito vinculante: inspección obligatoria como pre-gate antes de iniciar P0-E. |
| P0-V121-AUD-004 | Diferencias de formato en tablas de historial de versiones | Se acepta como observación editorial no bloqueante. |
| P0-V121-AUD-005 | Especificación de créditos v1.2.0 fuera del alcance de la enmienda | Se acepta su conservación intacta y su integración como documento relacionado del baseline. |
| P0-V121-AUD-006 | Precisiones adicionales sobre contentKind y carácter offline de pruebas TDS | Se acepta aplicar la precisión en las autorizaciones y especificaciones ejecutivas de P0-B, sin considerar que exista ambigüedad ejecutable en el baseline aprobado. |

### 3. Alcance de la aprobación

Quedan aprobados como baseline documental:

1. LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md — v1.2.1.
2. LEGAL-AI-JURISPRUDENCE-SPEC-001.md — v1.2.1.
3. LEGAL-AI-NORMATIVE-SPEC-001.md — v1.2.1.
4. LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md — v1.2.1.
5. LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md — v1.2.1.
6. LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md — v1.0.1.
7. LEGAL-P0-A-EXECUTION-REPORT-001.md — v1.0.1.
8. LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md — v1.0.1.
9. LEGAL-AI-CREDITS-SPEC-001.md — v1.2.0, conservado sin modificaciones.

También se reconocen como antecedentes de trazabilidad el informe de enmienda documental y la auditoría independiente de cierre.

### 4. Efectos y límites

Esta aprobación:

- Establece v1.2.1 como baseline documental de referencia.
- Permite preparar su preservación mediante un commit Git dedicado.
- No autoriza modificar código productivo.
- No autoriza migraciones Prisma ni SQL.
- No autoriza cambios en PostgreSQL, roles, permisos o credenciales.
- No autoriza ejecutar scripts de ingesta.
- No autoriza iniciar P0-B.
- No autoriza iniciar F1.
- No modifica AUTH-01 a AUTH-11.

### 5. Decisiones ejecutivas todavía pendientes

Para iniciar P0-B deberán aprobarse separadamente:

- DEC-IMPL-P0B: autorización de implementación de P0-B.
- DEC-ADR-01-EXEC: autorización de creación física del rol worker PostgreSQL.
- DEC-ADR-02: decisión de almacenamiento privado local o S3.
- DEC-ADR-03: decisión de retención y versionado documental.

Las decisiones comerciales, de fuentes externas, licencias y presupuesto mantienen sus condiciones y gates respectivos.

### 6. Preservación del baseline

El versionado Git deberá realizarse en un commit dedicado, limitado a los documentos aprobados y a su trazabilidad.

Antes del commit se deberá:

- Identificar exactamente los nueve documentos aprobados y los informes de trazabilidad correspondientes.
- Verificar el contenido y las versiones de cada archivo.
- Preservar los 90 archivos rastreados modificados y los 110 elementos untracked preexistentes, sin incorporarlos accidentalmente.
- Evitar staging global (`git add .` o equivalente).
- Verificar el staging mediante inspección individual.
- No modificar ni descartar cambios preexistentes.
- Registrar el hash del commit y la evidencia de integridad.

El commit deberá ser documental, aislado y trazable.

### 7. Resolución final

Se declara aprobado el baseline documental v1.2.1 con las seis observaciones aceptadas.

La aprobación documental no equivale a autorización de implementación.

**Estado P0-B: NO AUTORIZADA.**

**Estado F1: NO AUTORIZADA.**

**Estado del baseline documental: APROBADO.**

