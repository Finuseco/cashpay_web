import { createProjectsHandler } from '../../../lib/projects/handler.js';
import { recordSubmissionContact } from '@/lib/main-site/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handle = createProjectsHandler({ recordContact: recordSubmissionContact });

export async function POST(request: Request) { return handle(request); }
export async function OPTIONS(request: Request) { return handle(request); }
