import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileAsync = promisify(execFile);

export interface BackupResult {
  executed: boolean;
  reason?: string;
  filePath?: string;
  sizeBytes?: number;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;

  constructor(private configService: ConfigService) {
    // Prepare local backup directory (in prod this would be temporary before S3 upload)
    this.backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Daily Database Snapshot (Midnight)
   *
   * SPEC-AUTH-004 §5.2 & §10.4:
   * - BackupModule must NOT be mounted in AppModule; this cron only runs in the dedicated backup runner process.
   * - Guard 1: BACKUP_RUNNER_ENABLED must be explicitly set to 'true' in the runner environment.
   * - Guard 2: BACKUP_DATABASE_URL must differ from DATABASE_URL and must NOT contain 'abogados_app_user'.
   *   These guards ensure the runtime app process can never accidentally perform privileged backups.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyBackup(): Promise<BackupResult> {
    // Guard 1: Only execute when explicitly enabled in a dedicated runner environment.
    const runnerEnabled = this.configService.get<string>(
      "BACKUP_RUNNER_ENABLED",
    );
    if (runnerEnabled !== "true") {
      this.logger.warn(
        "BackupService: BACKUP_RUNNER_ENABLED is not 'true'. Skipping backup (fail-closed).",
      );
      return { executed: false, reason: "BACKUP_RUNNER_DISABLED" };
    }

    // Guard 2: Verify BACKUP_DATABASE_URL is a dedicated backup role (not the runtime role).
    const dbUrl = this.configService.get<string>("BACKUP_DATABASE_URL");
    const runtimeUrl = this.configService.get<string>("DATABASE_URL") ?? "";

    if (!dbUrl) {
      this.logger.error(
        "BackupService: BACKUP_DATABASE_URL not configured. Skipping backup.",
      );
      return { executed: false, reason: "BACKUP_DATABASE_URL_MISSING" };
    }

    // Reject if backup URL == runtime URL OR if backup URL contains the runtime app user identity.
    const urlsMatch = dbUrl === runtimeUrl;
    const containsAppUser =
      dbUrl.includes("abogados_app_user") ||
      runtimeUrl.includes(dbUrl.split("@")[0]);

    if (urlsMatch || containsAppUser) {
      this.logger.error(
        "BackupService: BACKUP_DATABASE_URL resolves to the runtime application role. " +
          "Backup role separation violated. Skipping backup (fail-closed).",
      );
      return { executed: false, reason: "INVALID_BACKUP_ROLE_SEPARATION" };
    }

    // Actual backup execution
    this.logger.log("BackupService: Starting Daily Backup Process...");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-snapshot-${timestamp}.sql`;
    const filePath = path.join(this.backupDir, filename);

    try {
      this.logger.log(`BackupService: Executing pg_dump to ${filename}...`);

      // Strip schema query param — pg_dump uses the connection string directly.
      const pgDumpUrl = this.stripSchemaQueryParam(dbUrl);

      // NOTE: pg_dump must be available in PATH (or set PG_DUMP_PATH env var).
      const pgDump = process.env.PG_DUMP_PATH ?? "pg_dump";

      const { stderr } = await execFileAsync(pgDump, [
        `--dbname=${pgDumpUrl}`,
        "--format=c",
        "--blobs",
        `--file=${filePath}`,
      ]);

      if (stderr) {
        // pg_dump writes verbose info to stderr; not necessarily an error.
        this.logger.debug(`pg_dump output: ${stderr.substring(0, 200)}...`);
      }

      // Integrity check: file must exist and be non-empty.
      const stats = fs.statSync(filePath);
      if (stats.size > 0) {
        this.logger.log(
          `BackupService: Backup SUCCESS. Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB. Saved to: ${filePath}`,
        );

        // TODO: Upload to S3 (Cold Storage)
        // await this.uploadToS3(filePath);

        // Retention: clean up local backups older than 7 days.
        this.cleanupOldLocalBackups();

        return { executed: true, filePath, sizeBytes: stats.size };
      } else {
        this.logger.error("BackupService: Backup file created but is empty.");
        return { executed: false, reason: "BACKUP_FILE_EMPTY" };
      }
    } catch (error) {
      this.logger.error("BackupService: Backup FAILED.", error);
      return { executed: false, reason: "BACKUP_EXECUTION_ERROR" };
    }
  }

  private stripSchemaQueryParam(dbUrl: string): string {
    try {
      const parsed = new URL(dbUrl);
      parsed.searchParams.delete("schema");
      return parsed.toString();
    } catch {
      return dbUrl;
    }
  }

  private cleanupOldLocalBackups() {
    this.logger.log("BackupService: Cleaning up old local backups...");
    // Implementation: remove files older than 7 days from backupDir.
    try {
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      for (const file of fs.readdirSync(this.backupDir)) {
        const filePath = path.join(this.backupDir, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > sevenDaysMs) {
          fs.unlinkSync(filePath);
          this.logger.log(`BackupService: Removed old backup: ${file}`);
        }
      }
    } catch (err) {
      this.logger.warn("BackupService: Cleanup error.", err);
    }
  }
}
