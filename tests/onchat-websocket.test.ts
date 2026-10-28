import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import jwt from 'jsonwebtoken';

test('WebSocket verifies JWTs and forwards only to conversation participants', async () => {
    const queries: string[] = [];
    let admitted = false;
    const listener = new EventEmitter() as any;
    listener.query = async () => ({});
    listener.release = () => {};
    class Pool {
        connect = async () => listener;
        query = async (sql: string) => { queries.push(sql); return { rows: sql.includes('FROM meetings m') ? (admitted ? [{}] : []) : sql.includes('SELECT m.*') ? [{ id: 'msg7', conversation_id: 'conv', recipient_id: 8, sender_id: 7, content: 'Bonjour', type: 'text', status: 'sent', created_at: '2026-10-28T00:00:00Z' }] : sql.includes('SELECT cp.user_id') ? [{ user_id: 8 }] : [{}] }; };
    }
    class Server extends EventEmitter { handleUpgrade() {} }
    const context = vm.createContext({ require: (name: string) => ({
        'dotenv/config': {}, http: { createServer: () => Object.assign(new EventEmitter(), { listen() {} }) },
        crypto: {}, jsonwebtoken: jwt, pg: { Pool }, ws: { WebSocketServer: Server, WebSocket: { OPEN: 1 } },
    } as any)[name], process: { env: { JWT_SECRET: 'test-only-signing-key' }, on() {} }, console, setTimeout, clearTimeout });
    vm.runInContext(fs.readFileSync('server/onchat/ws-server.js', 'utf8'), context);
    const authenticate = vm.runInContext('authenticate', context);
    const token = jwt.sign({ id: 7 }, 'test-only-signing-key');
    assert.equal(authenticate({ headers: { authorization: `Bearer ${token}` } }).id, 7);
    assert.equal(authenticate({ headers: { cookie: 'cashpay-token=not-a-jwt' } }), null);
    assert.equal(authenticate({ headers: { cookie: 'bad=%XX' } }), null);
    const sent: any[] = [];
    const socket = { readyState: 1, send: (text: string) => sent.push(JSON.parse(text)) };
    vm.runInContext('addConnection', context)(8, socket);
    await vm.runInContext('handleEvent', context)(socket, { id: 7 }, {
        event: 'call.offer', data: { conversationId: 'conv', senderId: 99, sdp: 'offer' },
    });
    assert.ok(queries.some(sql => sql.includes('cp.user_id = $2')));
    assert.equal(sent[0].event, 'call.offer');
    assert.equal(sent[0].data.senderId, 7);
    assert.equal(sent[0].data.conversationId, 'conv');
    await listener.listeners('notification')[0]({ channel: 'onchat_messages', payload: JSON.stringify({ id: 'msg7' }) });
    assert.equal(sent[1].event, 'chat.message.created');
    assert.equal(sent[1].data.message.id, 'msg7');
    assert.equal(sent[1].data.conversationId, 'conv');
    const handleMeet = vm.runInContext('handleMeetEvent', context);
    await handleMeet(socket, { id: 7 }, 'meet.join', { meetCode: 'room123' });
    assert.equal(sent[2].event, 'error');
    assert.equal(sent[2].data.code, 'MEET_NOT_FOUND');
    admitted = true;
    await handleMeet(socket, { id: 7 }, 'meet.join', { meetCode: 'room123' });
    assert.equal(sent[3].event, 'meet.peers');
    assert.ok(queries.some(sql => sql.includes('mp.user_id = $2 AND mp.left_at IS NULL')));
});
