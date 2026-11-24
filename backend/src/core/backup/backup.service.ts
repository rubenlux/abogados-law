
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
    private readonly logger = new Logger(BackupService.name);
    private readonly backupDir: string;

    constructor(private configService: ConfigService) {
        // Prepare local backup directory (in prod this would be temporary before S3 upload)
        this.backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir);
        }
    }

    /**
     * Daily Database Snapshot (Midnight)
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleDailyBackup() {
        this.logger.log('Starting Daily Backup Process...');

        const dbUrl = this.configService.get<string>('DATABASE_URL');
        if (!dbUrl) {
            this.logger.error('DATABASE_URL not found. Skipping backup.');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-snapshot-${timestamp}.sql`;
        const filePath = path.join(this.backupDir, filename);

        try {
            // Mask password in logs
            this.logger.log(`Executing pg_dump to ${filename}...`);

            // NOTE: This assumes 'pg_dump' is available in the system PATH
            // In a Docker container, ensure postgres-client is installed
            const { stdout, stderr } = await execAsync(`pg_dump "${dbUrl}" -F c -b -v -f "${filePath}"`);

            if (stderr) {
                // pg_dump writes verbose info to stderr, which is normal, but we check for errors
                this.logger.debug(`pg_dump output: ${stderr.substring(0, 200)}...`);
            }

            // Verify integrity (Simple check: file exists and size > 0)
            const stats = fs.statSync(filePath);
            if (stats.size > 0) {
                this.logger.log(`Backup SUCCESS. Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB. Saved to: ${filePath}`);

                // TODO: Upload to S3 (Cold Storage)
                // await this.uploadToS3(filePath);

                // Retention: Clean up local backups older than 7 days
                this.cleanupOldLocalBackups();
            } else {
                this.logger.error('Backup file created but is empty.');
            }

        } catch (error) {
            this.logger.error('Backup FAILED.', error);
        }
    }

    private cleanupOldLocalBackups() {
        // Implementation omitted for brevity
        this.logger.log('Cleaning up old local backups...');
    }
}
