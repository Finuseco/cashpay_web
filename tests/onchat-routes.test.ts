import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { NextResponse } from 'next/server';
import * as attachments from '../src/lib/chat-attachments';

function loadRoute(file: string, deps: Record<string, unknown>) {
    const exports: Record<string, any> = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(code, { exports, require: (id: string) => {
        if (id === 'next/server') return { NextResponse };
        if (id in deps) return deps[id];
        throw new Error(`Unexpected dependency: ${id}`);
    }, Buffer, File, process, console });
    return exports;
}

test('call history requires authentication and queries the session wallet', async () => {
    let user: any = null;
    const queries: any[] = [];
    const route = loadRoute('src/app/api/v1/calls/history/route.ts', {
        '@/lib/actions/user.actions': { getAuthenticatedUser: async () => user },
        '@/lib/db': { db: { query: async (_: string, params: unknown[]) => { queries.push(params); return { rowCount: 1, rows: [{ id: 7 }] }; } } },
    });
    const request = { nextUrl: new URL('https://example.test?walletId=victim'), headers: new Headers({ 'x-wallet-id': 'victim' }) };
    assert.equal((await route.GET(request)).status, 401);
    assert.equal(queries.length, 0);
    user = { id: 7, id_wallet: 'session-wallet' };
    assert.equal((await route.GET(request)).status, 200);
    assert.equal(queries[0][0], 'session-wallet');
});

test('message endpoint forwards owned attachments and returns object metadata', async () => {
    const captured: any[] = [];
    const fileUrl = '/api/uploads/onchat/7/12345678-1234-1234-1234-123456789abc.pdf';
    const route = loadRoute('src/app/api/v1/chat/conversations/[conversationId]/route.ts', {
        '@/lib/chat-attachments': attachments,
        '@/lib/actions/user.actions': { getAuthenticatedUser: async () => ({ id: 7 }) },
        '@/lib/db': { db: { getConnection: async () => ({ query: async () => ({ rows: [{ user_id: 7 }, { user_id: 8 }] }), release() {} }) } },
        '@/lib/actions/message.actions': { postMessage: async (...args: any[]) => { captured.push(args); return { id: 'msg', status: 'sent', metadata: JSON.stringify(args[7]) }; } },
    });
    const send = (body: unknown) => route.POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) }), { params: { conversationId: 'conv' } });
    const response = await send({ content: '', type: 'doc', fileUrl, fileName: 'report.pdf' });
    assert.equal(response.status, 201);
    assert.equal(captured[0][7].fileUrl, fileUrl);
    assert.equal((await response.json()).message.metadata.fileName, 'report.pdf');
    assert.equal((await send({ type: 'doc', fileUrl: fileUrl.replace('/7/', '/8/') })).status, 400);
    assert.equal((await send({ content: '   ' })).status, 400);
    assert.equal(captured.length, 1);
});

test('private downloads deny strangers and allow a conversation participant', async () => {
    let user: any = null;
    let participant = false;
    let reads = 0;
    const route = loadRoute('src/app/api/uploads/[...path]/route.ts', {
        path: await import('node:path'),
        fs: { promises: { readFile: async () => { reads++; return Buffer.from('abc'); } } },
        '@/lib/chat-attachments': attachments,
        '@/lib/actions/user.actions': { getAuthenticatedUser: async () => user },
        '@/lib/db': { db: { query: async () => ({ rows: participant ? [{}] : [] }) } },
    });
    const params = { params: { path: ['onchat', '7', '12345678-1234-1234-1234-123456789abc.pdf'] } };
    const request = new Request('https://example.test');
    assert.equal((await route.GET(request, params)).status, 401);
    user = { id: 8 };
    assert.equal((await route.GET(request, params)).status, 404);
    assert.equal(reads, 0);
    participant = true;
    const response = await route.GET(request, params);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(await response.text(), 'abc');
});
