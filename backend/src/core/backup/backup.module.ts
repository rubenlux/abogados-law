import { Module } from "@nestjs/common";
import { BackupService } from "./backup.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
