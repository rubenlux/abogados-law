/**
 * Seed idempotente de desarrollo local para Login Demo BFF (`AUTH-LOCAL-DEMO-SESSION-FIX-001`).
 *
 * REGLAS ESTRICTAS:
 * - Solo se ejecuta en entorno local de desarrollo sobre `abogados_db`.
 * - Rechaza ejecutarse en `production`, en `test`, o sobre `abogados_test` / hosts remotos.
 * - Crea o reutiliza de forma idempotente y transaccional:
 *   1) Organization ("Estudio Jurídico Demo", ACTIVE)
 *   2) User ("socio.demo@estudio.local")
 *   3) UserIdentity (issuer="https://local-demo.abogados.internal/", subject="local-demo|socio-principal")
 *   4) OrganizationMembership (role=ORG_ADMIN, status=ACTIVE)
 *
 * Uso:
 *   MIGRATION_DATABASE_URL="postgresql://postgres:...@localhost:5432/abogados_db?schema=public" npx ts-node scripts/seed-local-demo-auth.ts
 */

import * as path from "path";
import * as dotenv from "dotenv";
import {
  PrismaClient,
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
  UserRole,
} from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DEMO_ORG_CUIT = "30-71000000-9";
const DEMO_ORG_NAME = "Estudio Jurídico Demo";
const DEMO_ORG_TRADE_NAME = "Estudio Demo";
const DEMO_USER_EMAIL =
  process.env.LOCAL_DEMO_USER_EMAIL?.trim() || "socio.demo@estudio.local";
const DEMO_USER_FULLNAME = "Dr. Socio Demo";
const DEMO_IDENTITY_ISSUER =
  process.env.LOCAL_DEMO_IDENTITY_ISSUER?.trim() ||
  "https://local-demo.abogados.internal/";
const DEMO_IDENTITY_SUBJECT =
  process.env.LOCAL_DEMO_IDENTITY_SUBJECT?.trim() ||
  "local-demo|socio-principal";

function assertSafeLocalDevDatabase(rawUrl: string | undefined): string {
  const nodeEnv = (process.env.NODE_ENV || "development").trim();
  if (nodeEnv === "production" || nodeEnv === "test") {
    throw new Error(
      `ABORTED: seed-local-demo-auth cannot run with NODE_ENV=${nodeEnv}. Only development is allowed.`,
    );
  }
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error(
      "ABORTED: Provide MIGRATION_DATABASE_URL (or SEED_DATABASE_URL) pointing to local abogados_db.",
    );
  }
  const parsed = new URL(rawUrl);
  const host = parsed.hostname.toLowerCase();
  const dbName = parsed.pathname.replace(/^\/+/, "");
  if (!["localhost", "127.0.0.1"].includes(host)) {
    throw new Error(
      `ABORTED: Refusing to seed non-local host '${host}'. Only localhost/127.0.0.1 is allowed.`,
    );
  }
  if (dbName !== "abogados_db") {
    throw new Error(
      `ABORTED: Target database is '${dbName}'. This seed ONLY targets 'abogados_db' and never touches 'abogados_test'.`,
    );
  }
  return rawUrl;
}

async function main() {
  const targetUrl = assertSafeLocalDevDatabase(
    process.env.SEED_DATABASE_URL ||
      process.env.MIGRATION_DATABASE_URL ||
      process.env.DATABASE_URL,
  );

  const prisma = new PrismaClient({
    datasources: { db: { url: targetUrl } },
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Organization idempotente
      let organization = await tx.organization.findFirst({
        where: { cuit: DEMO_ORG_CUIT },
      });
      if (!organization) {
        organization = await tx.organization.create({
          data: {
            name: DEMO_ORG_NAME,
            tradeName: DEMO_ORG_TRADE_NAME,
            cuit: DEMO_ORG_CUIT,
            status: OrganizationStatus.ACTIVE,
            plan: "PRO",
          },
        });
      } else if (organization.status !== OrganizationStatus.ACTIVE) {
        organization = await tx.organization.update({
          where: { id: organization.id },
          data: { status: OrganizationStatus.ACTIVE },
        });
      }

      // 2. User idempotente (passwordHash no utilizable para login por contraseña)
      const user = await tx.user.upsert({
        where: { email: DEMO_USER_EMAIL },
        update: {
          fullName: DEMO_USER_FULLNAME,
        },
        create: {
          email: DEMO_USER_EMAIL,
          fullName: DEMO_USER_FULLNAME,
          passwordHash:
            "$2b$10$LOCALDEMONONUSABLEPASSWORDHASH0000000000000000000000000",
          role: UserRole.ASSOCIATE, // Legacy field, nunca autoridad
          organizationId: organization.id, // FK legacy de esquema, nunca autoridad
        },
      });

      // 3. UserIdentity idempotente
      const identity = await tx.userIdentity.upsert({
        where: {
          issuer_subject: {
            issuer: DEMO_IDENTITY_ISSUER,
            subject: DEMO_IDENTITY_SUBJECT,
          },
        },
        update: {
          userId: user.id,
          authEmail: user.email,
          lastUsedAt: new Date(),
        },
        create: {
          userId: user.id,
          issuer: DEMO_IDENTITY_ISSUER,
          subject: DEMO_IDENTITY_SUBJECT,
          provider: "local-demo",
          authEmail: user.email,
        },
      });

      // 4. OrganizationMembership idempotente (ORG_ADMIN, ACTIVE — nunca ORG_OWNER)
      const membership = await tx.organizationMembership.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: organization.id,
          },
        },
        update: {
          role: OrganizationRole.ORG_ADMIN,
          status: MembershipStatus.ACTIVE,
          revokedAt: null,
        },
        create: {
          userId: user.id,
          organizationId: organization.id,
          role: OrganizationRole.ORG_ADMIN,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      return { organization, user, identity, membership };
    });

    console.log(
      JSON.stringify(
        {
          status: "seeded",
          database: "abogados_db",
          organizationId: result.organization.id,
          organizationName: result.organization.name,
          userId: result.user.id,
          userEmail: result.user.email,
          identityProvider: result.identity.provider,
          membershipRole: result.membership.role,
          membershipStatus: result.membership.status,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Local demo seed failed:", err.message || err);
  process.exit(1);
});
