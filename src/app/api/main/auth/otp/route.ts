import { handleMainAuthRequest, mainAuthOptions } from '@/lib/main-site/auth-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = mainAuthOptions;
export function POST(request: Request) { return handleMainAuthRequest(request, 'otp'); }
