import { createCareersHandler } from '../../../lib/careers/handler.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handle = createCareersHandler();

export async function POST(request: Request) { return handle(request); }
export async function OPTIONS(request: Request) { return handle(request); }
