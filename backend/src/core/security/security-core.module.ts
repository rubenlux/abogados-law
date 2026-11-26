import { Module, Global } from "@nestjs/common";
import { ForensicService } from "./forensic.service";
import { ConfigModule } from "@nestjs/config";

import { PixelGuard } from "./pixel.guard";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ForensicService, PixelGuard],
  exports: [ForensicService, PixelGuard],
})
export class SecurityCoreModule {}
