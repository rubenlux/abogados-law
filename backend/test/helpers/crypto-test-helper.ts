/**
/**
 * Helper Criptográfico para Pruebas Automatizadas de Auth0 y Tokens RS256.
 * Especificación: SPEC-AUTH-001 (AUTH-002, TST-AUTH-001 a TST-AUTH-008)
 *
 * Genera claves RSA y tokens JWT RS256/HS256/none en memoria de forma 100% determinista,
 * sin dependencias externas ni llamadas salientes de red.
 */
import * as crypto from "crypto";

export interface KeyPairResult {
  kid: string;
  publicKeyPem: string;
  privateKeyPem: string;
  jwk: {
    kty: string;
    use: string;
    alg: string;
    kid: string;
    n: string;
    e: string;
  };
}

export function generateTestRsaKeyPair(
  kid: string = "test-key-1",
): KeyPairResult {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  const jwkExport = crypto
    .createPublicKey(publicKey)
    .export({ format: "jwk" }) as { kty: string; n: string; e: string };

  const jwk = {
    kty: jwkExport.kty || "RSA",
    use: "sig",
    alg: "RS256",
    kid,
    n: jwkExport.n,
    e: jwkExport.e,
  };

  return {
    kid,
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    jwk,
  };
}

function base64UrlEncode(data: string | Buffer): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export interface JwtTokenOptions {
  kid?: string;
  alg?: string;
  issuer?: string;
  audience?: string;
  sub?: string;
  email?: string;
  expOffsetSeconds?: number;
  iatOffsetSeconds?: number;
  customClaims?: Record<string, any>;
  omitSub?: boolean;
}

export function createSignedTestJwt(
  options: JwtTokenOptions,
  privateKeyPem: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const alg = options.alg || "RS256";

  const header: Record<string, any> = {
    alg,
    typ: "JWT",
  };

  if (options.kid) {
    header.kid = options.kid;
  }

  const payload: Record<string, any> = {
    iss: options.issuer || "https://abogados-test.us.auth0.com/",
    aud: options.audience || "https://api.abogadoslaw.com",
    iat: now + (options.iatOffsetSeconds ?? 0),
    exp: now + (options.expOffsetSeconds ?? 3600),
    email: options.email || "abogado@estudio.com",
    ...options.customClaims,
  };

  if (!options.omitSub) {
    payload.sub = options.sub || "auth0|test-user-001";
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  if (alg === "none") {
    return `${signingInput}.`;
  }

  if (alg === "HS256") {
    const hmac = crypto.createHmac("sha256", privateKeyPem);
    hmac.update(signingInput);
    const signature = base64UrlEncode(hmac.digest());
    return `${signingInput}.${signature}`;
  }

  // RS256
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = base64UrlEncode(signer.sign(privateKeyPem));

  return `${signingInput}.${signature}`;
}

export function corruptTokenSignature(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3) return token + "_corrupted";
  const sig = parts[2];
  const corruptedSig =
    sig.slice(0, -4) + (sig.slice(-4) === "AAAA" ? "ZZZZ" : "AAAA");
  return `${parts[0]}.${parts[1]}.${corruptedSig}`;
}
