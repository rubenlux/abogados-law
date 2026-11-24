
// import { apiClient } from '../../api/client'; 
import CryptoJS from 'crypto-js';

export type EventType =
    | 'LOGIN'
    | 'LOGOUT'
    | 'VIEW_PAGE'
    | 'VIEW_EXPEDIENTE'
    | 'GENERATE_DOC'
    | 'AI_PROMPT'
    | 'EXPORT_DATA'
    | 'ERROR_BOUNDARY';

interface EventPayload {
    [key: string]: any;
}

class LegalPixelClass {
    private sessionId: string;
    private userId: string | null = null;
    private organizationId: string | null = null;
    private queue: any[] = [];
    private isProcessing = false;

    constructor() {
        this.sessionId = Math.random().toString(36).substring(2, 15);
        if (this.isProcessing && this.queue.length > 0) console.log('Processing queue...');
        this.init();
    }

    private init() {
        // Try to recover user from storage if app reloads
        try {
            const storedUser = localStorage.getItem('auth-storage'); // Zustand persist default
            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                if (parsed.state?.user) {
                    this.userId = parsed.state.user.id;
                    this.organizationId = parsed.state.user.organizationId;
                }
            }
        } catch (e) {
            console.warn('Pixel init warning:', e);
        }
    }

    public identify(userId: string, organizationId: string) {
        this.userId = userId;
        this.organizationId = organizationId;
    }

    public clearIdentity() {
        this.userId = null;
        this.organizationId = null;
        // Rotate session on logout
        this.sessionId = Math.random().toString(36).substring(2, 15);
    }

    public track(eventType: EventType, payload?: EventPayload, entityId?: string) {
        const event = {
            actorType: 'USER', // Default for frontend app
            actorId: this.userId || 'anonymous',
            organizationId: this.organizationId,
            sessionId: this.sessionId,
            eventType,
            entityId,
            payload,
            timestamp: new Date().toISOString()
        };

        console.log('[LegalPixel] 📸 Event:', eventType, payload);
        // Send immediately for MVP (Queueing logic can be added for optimization)
        this.send(event);
    }

    private async send(eventData: any) {
        try {
            // --- SECURITY HEADERS IMPLEMENTATION ---
            // WARNING: In a real production app, the HMAC secret should NOT be stored in the frontend.
            // This architecture implies a client-side secret (less secure) or a proxy.
            // For the purpose of "Enterprise Hardening" specified in the prompt, we implement the requested signature.
            const HMAC_SECRET = import.meta.env.VITE_PIXEL_KEY || 'default-insecure-key-REPLACE-ME';

            const timestamp = new Date().getTime().toString();
            const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);

            // Signature Payload: orgId + timestamp + nonce + body
            // We need to ensure body stringification matches backend exactly.
            const bodyString = JSON.stringify(eventData);
            const signaturePayload = (this.organizationId || '') + timestamp + nonce + bodyString;

            // Generate HMAC
            // @ts-ignore
            const signature = CryptoJS.HmacSHA256(signaturePayload, HMAC_SECRET).toString();

            await fetch('http://localhost:3000/events/collect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Org-Id': this.organizationId || '',
                    'X-Timestamp': timestamp,
                    'X-Nonce': nonce,
                    'X-Signature': signature
                },
                body: bodyString,
                keepalive: true // Ensures request completes even if page unloads
            });
        } catch (error) {
            // Silent fail - analytics should not pollute console in dev
            console.error('Legal Pixel Drop:', error);
        }
    }
}

export const LegalPixel = new LegalPixelClass();
