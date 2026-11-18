export class MainAuthError extends Error {
  constructor(status: number, code: string, message: string);
  status: number;
  code: string;
}
export interface MainAdminUser { id: number; walletId: string; fullName: string; role: 'Admin'; }
export interface StoredUser {
  id: number;
  id_wallet: string;
  full_name?: string;
  first_name?: string;
  email?: string;
  phone?: string;
  pin_hash?: string;
  notifications_channel?: string | string[];
  role: string;
  status: string;
}
export interface MainAuthService {
  start(input: { walletId: unknown; channel?: unknown; ip?: string }): Promise<{ challengeToken: string; step: string; channel: string; availableChannels: string[]; maskedDestination: string; expiresAt: string }>;
  verifyOtp(token: string | undefined, otp: unknown): Promise<{ step: string; expiresAt: string }>;
  verifyPin(token: string | undefined, pin: unknown): Promise<{ sessionToken: string; user: MainAdminUser; expiresAt: string }>;
  session(token: string | undefined): Promise<{ user: MainAdminUser; expiresAt: string }>;
  logout(sessionToken?: string, challengeToken?: string): Promise<void>;
}
export function createMainAuth(options: { store: unknown; deliverOtp: (request: { user: StoredUser; channel: string; otp: string }) => Promise<boolean>; checkPin: (pin: string, user: StoredUser) => Promise<boolean> }): MainAuthService;
export function safeEqual(left: string, right: string): boolean;
export function digest(value: string): string;
export const AUDIENCE: string;
export const CHALLENGE_TTL_MS: number;
export const SESSION_TTL_MS: number;
