import { db } from '@/lib/db';
import * as bcrypt from 'bcryptjs';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { sendWhatsAppTextMessage } from '@/services/whatsapp';
import { createMainAuth, MainAuthError, safeEqual } from './auth-core.cjs';
import type { MainAdminUser } from './auth-core.cjs';
import { createAuthStore } from './auth-store.cjs';
import { createOtpDelivery } from './auth-delivery.cjs';
import { createAuthHandler } from './auth-http.cjs';
import * as http from './http';

export { MainAuthError };
export type { MainAdminUser };

const auth = createMainAuth({
  store: createAuthStore(db),
  deliverOtp: createOtpDelivery({ sendEmail, sendSms, sendWhatsAppTextMessage }),
  async checkPin(pin, user) {
    const stored = user.pin_hash || '';
    if (/^\$2[aby]\$/.test(stored)) {
      try { return await bcrypt.compare(pin, stored); } catch { return false; }
    }
    // Preserve existing legacy PIN login compatibility without a wallet session.
    return /^\d{4,8}$/.test(stored) && safeEqual(pin, stored);
  },
});

const handler = createAuthHandler({ auth, http, development: process.env.NODE_ENV === 'development', trustProxy: process.env.MAIN_TRUST_PROXY === '1' });
export const MAIN_SESSION_COOKIE = handler.sessionCookie;
export const MAIN_CHALLENGE_COOKIE = handler.challengeCookie;

/** Only the dedicated Main cookie is accepted; DB role and status are rechecked. */
export async function requireMainAdmin(request: Request): Promise<MainAdminUser> {
  return handler.requireMainAdmin(request);
}

export function mainAuthOptions(request: Request): Response { return handler.options(request); }
export function handleMainAuthRequest(request: Request, action: 'start' | 'otp' | 'pin' | 'session' | 'logout'): Promise<Response> {
  return handler.handle(request, action);
}
