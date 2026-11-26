/**
 * Fixture Determinista para el Modelo User de Prisma.
 * Especificación: SPEC-TST-001 (OBS-006)
 *
 * Utiliza estrictamente los tipos de @prisma/client y los campos reales de schema.prisma.
 * Prohibido el uso de `as any` o la invención de propiedades.
 */
import {
  User,
  UserIdentity,
  UserSession,
  OidcTransaction,
  UserRole,
} from "@prisma/client";

export const createFixtureUser = (overrides?: Partial<User>): User => ({
  id: "usr-test-00000000-0000-0000-0000-000000000001",
  email: "test.user@abogados.com",
  passwordHash: "$2b$04$testSaltHashDeterministic4CharsCostOnlyForTestPurpose!",
  fullName: "Dra. María Test",
  role: UserRole.ASSOCIATE,
  permissions: null,
  refreshTokenHash: null,
  organizationId: "org-test-00000000-0000-0000-0000-000000000001",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

export const createFixtureUserIdentity = (
  overrides?: Partial<UserIdentity>,
): UserIdentity => ({
  id: "id-test-00000000-0000-0000-0000-000000000001",
  userId: "usr-test-00000000-0000-0000-0000-000000000001",
  issuer: "https://abogados-test.us.auth0.com/",
  subject: "auth0|test-user-001",
  provider: "auth0",
  authEmail: "test.user@abogados.com",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

export const createFixtureUserSession = (
  overrides?: Partial<UserSession>,
): UserSession => ({
  id: "ses-test-00000000-0000-0000-0000-000000000001",
  userId: "usr-test-00000000-0000-0000-0000-000000000001",
  activeOrganizationId: null,
  sessionToken:
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  sessionVersion: 1,
  auth0Sid: "auth0-sid-test-123",
  deviceInfo: "Mozilla/5.0 Test Agent",
  ipAddress: "127.0.0.1",
  expiresAt: new Date(Date.now() + 8 * 3600 * 1000), // 8h
  idleExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30m
  revokedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  lastActiveAt: new Date(),
  ...overrides,
});

export const createFixtureOidcTransaction = (
  overrides?: Partial<OidcTransaction>,
): OidcTransaction => ({
  transactionId: "tx-test-00000000-0000-0000-0000-000000000001",
  state: "state-test-1234567890abcdef",
  nonce: "nonce-test-1234567890abcdef",
  codeVerifier:
    "v1:0123456789abcdef01234567:0123456789abcdef0123456789abcdef:0123456789abcdef",
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10m
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});
