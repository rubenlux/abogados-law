-- =============================================================================
-- AUTH-04 Phase C — Category C Least-Privilege Revocation
-- Specification: SPEC-AUTH-004 v0.2.0 — APPROVED (§10.4, DEC-04-02)
-- Expediente: AUTH04-POST-IMPLEMENTATION-RECONCILIATION-001
-- =============================================================================
-- This migration corrects the Category C grant matrix for abogados_app_user.
-- It revokes excess privileges confirmed by D-01 and D-02 findings.
--
-- Corrections applied:
--   D-01: Revoke DELETE on UserSession (keep INSERT/SELECT/UPDATE).
--   D-02a: Downgrade UserIdentity to SELECT-only (revoke INSERT, UPDATE, DELETE).
--   D-02b: Revoke INSERT and DELETE on User (keep SELECT; restrict UPDATE to refreshTokenHash only).
--   D-02c: Revoke UPDATE on OidcTransaction (keep SELECT, INSERT, DELETE for atomic DELETE...RETURNING).
--   D-02d: Restrict UserSession UPDATE to mutable columns only (revokedAt, lastActiveAt,
--           idleExpiresAt, activeOrganizationId); revoke UPDATE on immutable columns.
-- =============================================================================

-- ---- D-01: UserSession — revoke DELETE (keep SELECT, INSERT, UPDATE) ---------------------
REVOKE DELETE ON TABLE "UserSession" FROM abogados_app_user;

-- ---- D-02a: UserIdentity — downgrade to SELECT only ------------------------------------
REVOKE INSERT, UPDATE, DELETE ON TABLE "UserIdentity" FROM abogados_app_user;

-- ---- D-02b: User — revoke INSERT and DELETE; restrict UPDATE to refreshTokenHash + updatedAt ----------
REVOKE INSERT, DELETE ON TABLE "User" FROM abogados_app_user;
-- Restrict UPDATE: revoke table-level UPDATE, then re-grant column-level.
-- AuthService.logout: UPDATE "User" SET "refreshTokenHash" = NULL, "updatedAt" = NOW() WHERE id = ?
-- Prisma @updatedAt automatically appends updatedAt to every update, so both columns are required.
-- BffSessionService.validateSession uses SELECT only on User.
REVOKE UPDATE ON TABLE "User" FROM abogados_app_user;
GRANT UPDATE ("refreshTokenHash", "updatedAt") ON TABLE "User" TO abogados_app_user;

-- ---- D-02c: OidcTransaction — revoke UPDATE (keep SELECT, INSERT, DELETE) ----------------
REVOKE UPDATE ON TABLE "OidcTransaction" FROM abogados_app_user;

-- ---- D-02d: UserSession — restrict UPDATE to mutable columns only ------------------------
-- Mutable columns: revokedAt, lastActiveAt, idleExpiresAt, activeOrganizationId
-- Immutable columns: sessionToken, userId, expiresAt, sessionVersion, auth0Sid, createdAt
REVOKE UPDATE ON TABLE "UserSession" FROM abogados_app_user;
GRANT UPDATE ("revokedAt", "lastActiveAt", "idleExpiresAt", "activeOrganizationId") ON TABLE "UserSession" TO abogados_app_user;
