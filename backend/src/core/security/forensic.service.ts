import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ForensicService {
  // In production, this must be a private key loaded from a secure vault (AWS KMS / Hashicorp Vault)
  // For MVP, we use a strong environment variable string
  private readonly SECRET_KEY: string;

  constructor(private configService: ConfigService) {
    this.SECRET_KEY =
      this.configService.get<string>("FORENSIC_KEY") ||
      "default-insecure-key-REPLACE-ME";
  }

  /**
   * Calculates the SHA-256 hash of the event data + previous hash (Blockchain chaining)
   */
  calculateEventHash(
    prevHash: string | null,
    timestamp: Date,
    actorId: string,
    payload: any,
  ): string {
    const data = JSON.stringify({
      prev: prevHash || "GENESIS",
      ts: timestamp.toISOString(),
      actor: actorId,
      load: payload, // Payload should be sorted keys to be deterministic
    });

    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Generates an HMAC signature to prove the event was logged by THIS authenticated server
   */
  signEvent(currentHash: string): string {
    return crypto
      .createHmac("sha256", this.SECRET_KEY)
      .update(currentHash)
      .digest("hex");
  }

  /**
   * Verifies if a log entry has been tampered with
   */
  verifyLogIntegrity(log: any, prevHash: string | null): boolean {
    const reCalc = this.calculateEventHash(
      prevHash,
      log.timestamp,
      log.actorId,
      log.payload,
    );
    if (reCalc !== log.currentHash) return false;

    const reSign = this.signEvent(reCalc);
    if (reSign !== log.signature) return false;

    return true;
  }

  // --- AUTOMATED RETENTION POLICY (ENTERPRISE) ---
  // Cron: Run every night at 3 AM
  // In a real app, uses Batch Processing or a separate worker microservice
  // @Cron('0 3 * * *')
  async archiveOldEvents() {
    // Mock Implementation of "Warm" Storage move
    // 1. Find events > 90 days
    // 2. Export to JSONL
    // 3. Upload to S3 (abogado-forensic-archive)
    // 4. Delete from Hot DB (Prisma)

    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - 90);

    // console.log(`[Forensic] Running Archival Job for events before ${retentionDate.toISOString()}...`);
    // Implementation would go here
  }
}
