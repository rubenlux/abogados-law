
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

@Injectable()
export class PixelGuard implements CanActivate {
    private readonly HMAC_SECRET: string;

    constructor(private configService: ConfigService) {
        // Fallback default MUST match the frontend default for this prototype/MVP
        this.HMAC_SECRET = this.configService.get<string>('PIXEL_HMAC_SECRET') || 'default-insecure-key-REPLACE-ME';
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();

        const orgId = request.headers['x-org-id'] as string;
        const timestamp = request.headers['x-timestamp'] as string;
        const nonce = request.headers['x-nonce'] as string;
        const signature = request.headers['x-signature'] as string;

        if (!timestamp || !nonce || !signature) {
            throw new BadRequestException('Missing Security Headers (X-Timestamp, X-Nonce, X-Signature)');
        }

        // 1. Timestamp Validation (Replay Attack Protection - Time Window)
        const ts = parseInt(timestamp);
        const now = Date.now();
        if (Math.abs(now - ts) > 60000) { // 60s window
            throw new UnauthorizedException('Request Expired (Timestamp skew > 60s)');
        }

        // 2. Signature Validation
        // Signature = HMAC_SHA256(orgId + timestamp + nonce + bodyJSON, SECRET)
        // Note: We must use the raw string body. In NestJS, 'request.body' is already parsed JSON.
        // Re-stringifying might differ from client formatting (spacing/sorting). 
        // Ideally, we use a raw text body parser or trust that JSON.stringify(body) matches.
        // For this implementation, we assume standard JSON behavior (no formatting).

        const bodyString = JSON.stringify(request.body);
        const payload = (orgId || '') + timestamp + nonce + bodyString;

        const expectedSignature = crypto
            .createHmac('sha256', this.HMAC_SECRET)
            .update(payload)
            .digest('hex');

        if (signature !== expectedSignature) {
            // Log for debugging (remove in prod to avoid leaking)
            // console.log(`Sig Fail. Client: ${signature}, Server: ${expectedSignature}`);
            throw new UnauthorizedException('Invalid Signature');
        }

        // 3. Nonce Validation (Stateful)
        // TODO: Ideally check Redis if nonce was used in the last 60s. 
        // Skipping for MVP as we don't have Redis setup yet.

        return true;
    }
}
