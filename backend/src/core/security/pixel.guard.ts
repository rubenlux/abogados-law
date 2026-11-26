import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { Request } from "express";

@Injectable()
export class PixelGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const hmacSecret = this.configService
      .get<string>("PIXEL_HMAC_SECRET")
      ?.trim();
    if (!hmacSecret || hmacSecret.length < 32) {
      throw new ServiceUnavailableException(
        "PIXEL_HMAC_SECRET is not configured (fail-closed)",
      );
    }

    const request = context.switchToHttp().getRequest<Request>();

    const orgId = request.headers["x-org-id"] as string;
    const timestamp = request.headers["x-timestamp"] as string;
    const nonce = request.headers["x-nonce"] as string;
    const signature = request.headers["x-signature"] as string;

    if (!timestamp || !nonce || !signature) {
      throw new BadRequestException(
        "Missing Security Headers (X-Timestamp, X-Nonce, X-Signature)",
      );
    }

    const ts = parseInt(timestamp, 10);
    const now = Date.now();
    if (Number.isNaN(ts) || Math.abs(now - ts) > 60000) {
      throw new UnauthorizedException("Request Expired (Timestamp skew > 60s)");
    }

    const bodyString = JSON.stringify(request.body);
    const payload = (orgId || "") + timestamp + nonce + bodyString;

    const expectedSignature = crypto
      .createHmac("sha256", hmacSecret)
      .update(payload)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "utf8");
    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      throw new UnauthorizedException("Invalid Signature");
    }

    return true;
  }
}
