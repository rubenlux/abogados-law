# Security & Compliance Model

## 1. Data Integrity & Trust
Since this is a LegalTech platform, data integrity is paramount.

### WORM (Write Once, Read Many)
*   **Legal Documents**: Stored in S3 with Object Lock enabled in Compliance Mode. Once uploaded, a document cannot be modified or deleted until the retention period expires (or litigation hold is lifted).
*   **Audit Logs**: Stored in PostgreSQL with a cryptographic hash chain. Each log entry contains `prevHash = SHA256(previous_row)`.

### Forensic Export
The system supports generating a `Digital Evidence Package` (ZIP) containing:
1.  Original files.
2.  Manifest file (JSON) with hashes.
3.  Digital signature of the platform.

## 2. Access Control (RBAC)
*   **Tenant Isolation**: Logical separation via `organizationId` in every database query. Use of NestJS Interceptors to enforce this automatically is planned.
*   **Roles**:
    *   `ADMIN`: Full control over tenant settings.
    *   `PARTNER`: Can view all cases and audit logs.
    *   `ASSOCIATE`: Can only view assigned cases.
    *   `PARALEGAL`: Read-only access to assigned cases.

## 3. AI Safety & Privacy
*   **Zero-Retention Policy**: We do not use client data to train public models.
*   **Sanitization**: PII (Personally Identifiable Information) is redacted before sending to LLM execution contexts via regex patterns (e.g. CBU, DNI).
*   **Grounding**: AI answers are strictly grounded in retrieved legal context (RAG). If context is insufficient, the AI refuses to answer.

## 4. Encryption
*   **At Rest**: AES-256 for database volumes and S3 buckets.
*   **In Transit**: TLS 1.3 for all internal and external communication.
