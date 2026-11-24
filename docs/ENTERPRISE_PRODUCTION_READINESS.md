# Enterprise Production Readiness (Hardening)

This document details the "Enterprise Hardening" features implemented to prepare the platform for production usage with real clients. These measures ensure security, auditability, and stability.

## 1. Secrets Management (Doppler)
**Status:** ✅ Implemented

We have integrated [Doppler](https://www.doppler.com/) to eliminate hardcoded secrets and `.env` files in production.

*   **Implementation:**
    *   Backend dependency: `@dopplerhq/node-sdk`
    *   Script: `npm run start:doppler` (Backend)

*   **Setup Instructions (Windows):**
    1.  **Install CLI** (PowerShell):
        ```powershell
        Set-ExecutionPolicy RemoteSigned -Scope CurrentUser; iwr -useb https://cli.doppler.com/install.ps1 | iex
        ```
    2.  **Verify**: Restart your terminal/VS Code and run `doppler --version`.
    3.  **Login**: `doppler login`
    4.  **Select Project**: `abogado-virtual`
    5.  **Run Backend**: `npm run start:doppler`

## 2. Environment Separation
**Status:** ⚠️ Partial / Architecture Ready

The architecture supports separation, but explicit deployment pipelines (CI/CD) need to be configured in GitHub Actions/GitLab CI.

*   **Strategy:**
    *   **Dev**: `DATABASE_URL_DEV` (Localhost/Docker)
    *   **Staging**: `DATABASE_URL_STAGING` (Cloud Sandbox)
    *   **Prod**: `DATABASE_URL_PROD` (Managed Instance)

## 3. Legal Pixel Security (HMAC Signing)
**Status:** ✅ Implemented

The `LegalPixel` endpoint (`/events/collect`) is now protected against tampering and unauthorized usage using HMAC-SHA256 signatures and Replay Protection.

*   **Frontend (`LegalPixel.ts`)**:
    *   Generates headers: `X-Org-Id`, `X-Timestamp`, `X-Nonce`, `X-Signature`.
    *   Signature = `HMAC_SHA256(orgId + timestamp + nonce + body, SECRET)`

*   **Backend (`PixelGuard` - `pixel.guard.ts`)**:
    *   Validates presence of security headers.
    *   **Anti-Replay**: Rejects requests older than **60 seconds**.
    *   **Integrity**: Re-calculates signature and rejects mismatches.

## 4. Forensic Retention & Archiving
**Status:** ✅ Implemented (Logic)

A forensic retention policy is coded to comply with legal data retention standards.

*   **Hot Storage (PostgreSQL)**: Last 90 days of active logs.
*   **Warm/Cold Archiving**:
    *   **Service**: `ForensicService` (`forensic.service.ts`)
    *   **Method**: `archiveOldEvents()`
    *   **Logic**: Moves logs > 90 days to JSONL format for S3 Upload (simulated in current version).

## 5. Automated Backups
**Status:** ✅ Implemented

Automated database snapshots are configured to ensure data recovery.

*   **Service**: `BackupService` (`backup.service.ts`)
*   **Frequency**: Daily at Midnight (`0 0 * * *`)
*   **Location**: local `backups/` directory (ready for S3 upload hook).
*   **Format**: `pg_dump` custom format (`.sql`).

## 6. Implementation Manifest

| Feature | Source File | Description |
| :--- | :--- | :--- |
| **Pixel Guard** | `backend/src/core/security/pixel.guard.ts` | NestJS Guard for HMAC validation |
| **Forensic Logic** | `backend/src/core/security/forensic.service.ts` | Hashing, Signing, Archiving logic |
| **Legal Pixel (FE)** | `frontend/src/core/analytics/LegalPixel.ts` | Client-side signing implementation |
| **Backup System** | `backend/src/core/backup/backup.service.ts` | Cron job for pg_dump |
| **Integrations** | `backend/src/app.module.ts` | Module registration |
