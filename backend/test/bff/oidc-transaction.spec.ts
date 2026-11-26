/**
 * Suite de Pruebas TDS para D-03: Persistencia de Transacciones OIDC, Clave Independiente AES-256-GCM y Consumo Atómico
 * Especificación: SPEC-AUTH-001 v1.0.8 (Baseline Consolidado)
 * Expediente: AUTH0-IMPLEMENTATION-005 / AUTH0-AUTH02-FINAL-VERIFICATION-006
 *
 * Cobertura de Hallazgos:
 * - D-03.1: Persistencia compartida en base de datos PostgreSQL (modelo OidcTransaction).
 * - D-03.2: Clave independiente OIDC_TRANSACTION_ENCRYPTION_KEY (exactamente 32 bytes hex), Fail-Closed al inicio, sin fallback a JWT_SECRET/CSRF_SECRET.
 * - D-03.3: Cifrado autenticado AES-256-GCM versionado (v1), IV aleatorio de 12 bytes, Auth Tag de 16 bytes.
 * - D-03.4: Fallo seguro ante ciphertext manipulado, auth tag alterado, clave incorrecta o versión desconocida.
 * - D-03.5: Cero exposición de clave, verifier o plaintext en logs.
 * - D-03.6: Consumo atómico mediante DELETE ... RETURNING ($queryRaw), anti-replay y prevención de concurrencia.
 * - D-03.7: Rechazo estricto de transacciones expiradas (TTL 10 minutos).
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { BadRequestException, Logger } from "@nestjs/common";
import * as crypto from "crypto";

import { OidcClientService } from "../../src/auth/bff/oidc-client.service";
import { PrismaService } from "../../src/prisma.service";
import { createPrismaMock, MockPrismaService } from "../mocks/prisma.mock";
import { createFixtureOidcTransaction } from "../fixtures/user.fixture";

describe("AUTH-02 D-03 — OIDC Persistent Transactions, Independent AES-256-GCM Key & Atomic Consumption TDS Suite", () => {
  let service: OidcClientService;
  let prismaMock: MockPrismaService;

  const VALID_ENCRYPTION_KEY_HEX =
    "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c";
  const OTHER_ENCRYPTION_KEY_HEX =
    "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0";
  const CSRF_SECRET = "test-csrf-hmac-secret-minimum-32-chars-long!";
  const JWT_SECRET = "test-jwt-secret-key-for-automated-testing-32-chars!";

  const buildServiceWithConfig = async (
    configOverrides: Record<string, any>,
    prisma: MockPrismaService,
  ): Promise<OidcClientService> => {
    const configMap: Record<string, any> = {
      AUTH0_DOMAIN: "abogados-test.us.auth0.com",
      AUTH0_ISSUER_URL: "https://abogados-test.us.auth0.com/",
      AUTH0_AUDIENCE: "https://api.abogadoslaw.com",
      AUTH0_CLIENT_ID: "test-client-id-123",
      AUTH0_CLIENT_SECRET: "test-client-secret-minimum-32-chars!",
      CSRF_SECRET,
      JWT_SECRET,
      ...configOverrides,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OidcClientService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => configMap[key],
          },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    return module.get<OidcClientService>(OidcClientService);
  };

  const encryptWithKey = (plaintext: string, keyHex: string): string => {
    const key = Buffer.from(keyHex, "hex");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, {
      authTagLength: 16,
    });
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    service = await buildServiceWithConfig(
      { OIDC_TRANSACTION_ENCRYPTION_KEY: VALID_ENCRYPTION_KEY_HEX },
      prismaMock,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("Startup Key Validation (Fail-Closed & Key Independence)", () => {
    it("should fail-closed at startup when OIDC_TRANSACTION_ENCRYPTION_KEY is missing even if CSRF_SECRET and JWT_SECRET are present", async () => {
      await expect(
        buildServiceWithConfig(
          {
            OIDC_TRANSACTION_ENCRYPTION_KEY: undefined,
            CSRF_SECRET,
            JWT_SECRET,
          },
          prismaMock,
        ),
      ).rejects.toThrow(/OIDC_TRANSACTION_ENCRYPTION_KEY/i);
    });

    it("should fail-closed at startup when OIDC_TRANSACTION_ENCRYPTION_KEY has wrong length or non-hex format", async () => {
      // Menor a 32 bytes (32 hex chars = 16 bytes)
      await expect(
        buildServiceWithConfig(
          {
            OIDC_TRANSACTION_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
          },
          prismaMock,
        ),
      ).rejects.toThrow(/OIDC_TRANSACTION_ENCRYPTION_KEY/i);

      // Mayor a 32 bytes (66 hex chars)
      await expect(
        buildServiceWithConfig(
          {
            OIDC_TRANSACTION_ENCRYPTION_KEY: VALID_ENCRYPTION_KEY_HEX + "aa",
          },
          prismaMock,
        ),
      ).rejects.toThrow(/OIDC_TRANSACTION_ENCRYPTION_KEY/i);

      // Caracteres no hexadecimales (64 chars pero no hex)
      await expect(
        buildServiceWithConfig(
          {
            OIDC_TRANSACTION_ENCRYPTION_KEY: "z".repeat(64),
          },
          prismaMock,
        ),
      ).rejects.toThrow(/OIDC_TRANSACTION_ENCRYPTION_KEY/i);
    });
  });

  describe("createTransaction", () => {
    it("should persist transaction in PostgreSQL with versioned AES-256-GCM ciphertext using independent 32-byte key and random 12-byte IV", async () => {
      const tx1 = await service.createTransaction();
      const tx2 = await service.createTransaction();

      expect(tx1.transactionId).toBeDefined();
      expect(tx2.transactionId).toBeDefined();
      expect(tx1.transactionId).not.toBe(tx2.transactionId);
      expect(tx1.state).toBeDefined();
      expect(tx1.nonce).toBeDefined();
      expect(tx1.codeVerifier).toBeDefined();
      expect(tx1.codeChallenge).toBeDefined();

      expect(prismaMock.oidcTransaction.create).toHaveBeenCalledTimes(2);
      const createCall1 = prismaMock.oidcTransaction.create.mock.calls[0][0];
      const createCall2 = prismaMock.oidcTransaction.create.mock.calls[1][0];

      // El verifier persistido NO debe estar en texto claro
      expect(createCall1.data.codeVerifier).not.toBe(tx1.codeVerifier);

      // Formato versionado v1:<iv_24hex>:<tag_32hex>:<ciphertext_hex>
      const parts1 = createCall1.data.codeVerifier.split(":");
      const parts2 = createCall2.data.codeVerifier.split(":");
      expect(parts1).toHaveLength(4);
      expect(parts1[0]).toBe("v1");
      expect(parts1[1]).toMatch(/^[0-9a-f]{24}$/i); // 12 bytes IV
      expect(parts1[2]).toMatch(/^[0-9a-f]{32}$/i); // 16 bytes auth tag
      expect(parts1[3]).toMatch(/^[0-9a-f]+$/i);

      // IV debe ser aleatorio por transacción
      expect(parts1[1]).not.toBe(parts2[1]);

      // Comprobar que el cifrado usó exactamente OIDC_TRANSACTION_ENCRYPTION_KEY (no CSRF_SECRET ni JWT_SECRET)
      const iv = Buffer.from(parts1[1], "hex");
      const tag = Buffer.from(parts1[2], "hex");
      const ct = Buffer.from(parts1[3], "hex");
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_ENCRYPTION_KEY_HEX, "hex"),
        iv,
        { authTagLength: 16 },
      );
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(ct),
        decipher.final(),
      ]).toString("utf8");
      expect(decrypted).toBe(tx1.codeVerifier);

      // Expiración <= 10 minutos
      const expiresAt = createCall1.data.expiresAt as Date;
      const diffMs = expiresAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(9 * 60 * 1000);
      expect(diffMs).toBeLessThanOrEqual(10 * 60 * 1000 + 5000);
    });
  });

  describe("consumeTransaction", () => {
    it("should atomically consume transaction via DELETE ... RETURNING ($queryRaw), decrypt codeVerifier and return complete object", async () => {
      const plaintextVerifier =
        "test-plain-code-verifier-43-chars-base64url-random";
      const encryptedVerifier = encryptWithKey(
        plaintextVerifier,
        VALID_ENCRYPTION_KEY_HEX,
      );

      const dbRecord = createFixtureOidcTransaction({
        transactionId: "tx-test-id-123",
        state: "state-secret-abc",
        nonce: "nonce-secret-xyz",
        codeVerifier: encryptedVerifier,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      prismaMock.$queryRaw.mockResolvedValueOnce([dbRecord]);

      const tx = await service.consumeTransaction(
        "tx-test-id-123",
        "state-secret-abc",
      );

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();

      expect(tx.transactionId).toBe("tx-test-id-123");
      expect(tx.state).toBe("state-secret-abc");
      expect(tx.nonce).toBe("nonce-secret-xyz");
      expect(tx.codeVerifier).toBe(plaintextVerifier);

      const expectedChallenge = crypto
        .createHash("sha256")
        .update(plaintextVerifier)
        .digest("base64url");
      expect(tx.codeChallenge).toBe(expectedChallenge);
    });

    it("should reject with BadRequestException when transaction is not found (single-use or replay)", async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        service.consumeTransaction("tx-already-consumed", "state-abc"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject with BadRequestException when transaction has expired in PostgreSQL", async () => {
      const expiredRecord = createFixtureOidcTransaction({
        transactionId: "tx-expired-id",
        state: "state-abc",
        codeVerifier: encryptWithKey("verifier", VALID_ENCRYPTION_KEY_HEX),
        expiresAt: new Date(Date.now() - 10000),
      });

      prismaMock.$queryRaw.mockResolvedValueOnce([expiredRecord]);

      await expect(
        service.consumeTransaction("tx-expired-id", "state-abc"),
      ).rejects.toThrow(/expired/i);
    });

    it("should reject with BadRequestException when state does not match", async () => {
      const dbRecord = createFixtureOidcTransaction({
        transactionId: "tx-state-test",
        state: "legitimate-state",
        codeVerifier: encryptWithKey("verifier", VALID_ENCRYPTION_KEY_HEX),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      prismaMock.$queryRaw.mockResolvedValueOnce([dbRecord]);

      await expect(
        service.consumeTransaction("tx-state-test", "tampered-state"),
      ).rejects.toThrow(/Invalid state/i);
    });

    it("should prevent race conditions on two concurrent callbacks (exactly one succeeds)", async () => {
      const tx = await service.createTransaction();

      const req1 = service.consumeTransaction(tx.transactionId, tx.state);
      const req2 = service.consumeTransaction(tx.transactionId, tx.state);

      const results = await Promise.allSettled([req1, req2]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe("Decryption Failure Safety & Log Hygiene", () => {
    it("should fail safely with BadRequestException on tampered ciphertext", async () => {
      const encrypted = encryptWithKey(
        "secret-verifier-value",
        VALID_ENCRYPTION_KEY_HEX,
      );
      const parts = encrypted.split(":");
      // Alterar el primer byte del ciphertext
      const flippedByte = (parseInt(parts[3].slice(0, 2), 16) ^ 0xff)
        .toString(16)
        .padStart(2, "0");
      const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${flippedByte}${parts[3].slice(2)}`;

      prismaMock.$queryRaw.mockResolvedValueOnce([
        createFixtureOidcTransaction({
          transactionId: "tx-tampered-ct",
          state: "state-1",
          codeVerifier: tampered,
        }),
      ]);

      await expect(
        service.consumeTransaction("tx-tampered-ct", "state-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail safely with BadRequestException on tampered auth tag", async () => {
      const encrypted = encryptWithKey(
        "secret-verifier-value",
        VALID_ENCRYPTION_KEY_HEX,
      );
      const parts = encrypted.split(":");
      const flippedTag = (parseInt(parts[2].slice(0, 2), 16) ^ 0xff)
        .toString(16)
        .padStart(2, "0");
      const tampered = `${parts[0]}:${parts[1]}:${flippedTag}${parts[2].slice(2)}:${parts[3]}`;

      prismaMock.$queryRaw.mockResolvedValueOnce([
        createFixtureOidcTransaction({
          transactionId: "tx-tampered-tag",
          state: "state-1",
          codeVerifier: tampered,
        }),
      ]);

      await expect(
        service.consumeTransaction("tx-tampered-tag", "state-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail safely with BadRequestException when decrypted with wrong OIDC_TRANSACTION_ENCRYPTION_KEY", async () => {
      const encryptedWithOtherKey = encryptWithKey(
        "secret-verifier-value",
        OTHER_ENCRYPTION_KEY_HEX,
      );

      prismaMock.$queryRaw.mockResolvedValueOnce([
        createFixtureOidcTransaction({
          transactionId: "tx-wrong-key",
          state: "state-1",
          codeVerifier: encryptedWithOtherKey,
        }),
      ]);

      await expect(
        service.consumeTransaction("tx-wrong-key", "state-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail safely with BadRequestException on unknown ciphertext version (e.g. v2)", async () => {
      const encrypted = encryptWithKey(
        "secret-verifier-value",
        VALID_ENCRYPTION_KEY_HEX,
      );
      const unknownVersion = encrypted.replace(/^v1:/, "v2:");

      prismaMock.$queryRaw.mockResolvedValueOnce([
        createFixtureOidcTransaction({
          transactionId: "tx-unknown-ver",
          state: "state-1",
          codeVerifier: unknownVersion,
        }),
      ]);

      await expect(
        service.consumeTransaction("tx-unknown-ver", "state-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should never log encryption key, codeVerifier, or plaintext during operations or errors", async () => {
      const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
      const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const errorSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation();

      const tx = await service.createTransaction();
      await service.consumeTransaction(tx.transactionId, tx.state);

      // Forzar un error de descifrado
      prismaMock.$queryRaw.mockResolvedValueOnce([
        createFixtureOidcTransaction({
          transactionId: "tx-log-check",
          state: "state-1",
          codeVerifier: "v2:00:00:00",
        }),
      ]);
      await expect(
        service.consumeTransaction("tx-log-check", "state-1"),
      ).rejects.toThrow(BadRequestException);

      const allLogOutput = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]
        .flat()
        .map(String)
        .join(" ");

      expect(allLogOutput).not.toContain(VALID_ENCRYPTION_KEY_HEX);
      expect(allLogOutput).not.toContain(tx.codeVerifier);
    });
  });
});
