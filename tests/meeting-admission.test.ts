import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file: string, dependencies: Record<string, unknown>) {
    const exports: any = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(code, { exports, require: (name: string) => { if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; }, console, process });
    return exports;
}
function fixture(options: any = {}) {
    const statements: string[] = []; const payments: any[] = []; let paid = options.paid || 0;
    const connection = { release() {}, query: async (sql: string, values: any[] = []) => {
        statements.push(sql);
        if (sql.includes('SELECT * FROM meetings')) return { rows: [{ id: 1, host_user_id: 9, topic: 'Formation', status: 'active', price_amount: 10, price_currency: 'USD', ...options.meeting }] };
        if (sql.includes('SELECT fee_paid')) return { rows: [{ fee_paid: paid }] };
        if (sql.includes('SELECT id, status FROM events')) return { rows: options.event ? [{ id: 3, status: options.event }] : [] };
        if (sql.includes('SELECT balances FROM wallets')) return { rows: [{ balances: { USD: options.balance ?? 100, CDF: 300000 } }] };
        if (sql.includes('SELECT user_id FROM wallets')) return { rows: [{ user_id: 7 }, { user_id: 9 }] };
        if (sql.includes('SELECT rate FROM exchange_rates')) return { rows: [{ rate: 2800 }] };
        if (sql.includes('SELECT 1 FROM group_members')) return { rows: [] };
        if (sql.includes('FROM tickets WHERE')) {
            assert.equal(values[1], 7);
            return { rows: options.ticket && values[2] === 'OC-personal-code' ? [{ id: 4 }] : [] };
        }
        if (sql.includes('INSERT INTO meeting_participants')) { if (values[3]) paid = values[3]; return { rows: [] }; }
        if (sql.includes('UPDATE tickets') || sql.includes('pg_notify') || ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
        throw new Error(`Unexpected SQL ${sql}`);
    } };
    const service = load('src/lib/meeting-access.ts', {
        '@/lib/db': { db: { getConnection: async () => connection } },
        '@/lib/actions/wallet.actions': { calculateTransactionFee: async () => 1 },
        '@/lib/actions/auth.actions': { verifyCurrentUserPin: async () => ({ success: options.pinValid !== false }) },
        '@/lib/utils': { countryToCode: () => 'CD' },
        '@/lib/actions/transaction.actions': { createTransaction: async (input: any) => { payments.push(input); assert.equal(input.connection, connection); return { success: true, senderNewBalance: options.actualBalance ?? 89 }; } },
    });
    return { service, statements, payments, user: { id: 7, country: 'CD' } };
}
test('paid admission charges and persists access in one transaction; reconnect never charges twice', async () => {
    const f = fixture();
    const result = await f.service.admitMeeting('room', f.user, { pin: '1234', currency: 'USD', consent: true, maxDebit: 11 });
    assert.equal(result.charged, true); assert.equal(f.payments.length, 1);
    assert.equal(f.payments[0].receiver_id, 9); assert.equal(f.payments[0].amount, 10);
    assert.equal(f.statements.at(-1), 'COMMIT');
    assert.equal((await f.service.admitMeeting('room', f.user, {})).charged, false);
    assert.equal(f.payments.length, 1);
});
test('wrong PIN, insufficient balance and missing consent never invoke the payment engine', async () => {
    for (const [options, body, code] of [
        [{ pinValid: false }, { pin: 'wrong', consent: true, maxDebit: 11 }, 'INVALID_PIN'],
        [{ balance: 1 }, { pin: '1234', consent: true, maxDebit: 11 }, 'INSUFFICIENT_BALANCE'],
        [{}, { pin: '1234', maxDebit: 11 }, 'PAYMENT_CONFIRMATION_REQUIRED'],
    ] as any[]) {
        const f = fixture(options);
        await assert.rejects(f.service.admitMeeting('room', f.user, body), (error: any) => error.code === code);
        assert.equal(f.payments.length, 0); assert.equal(f.statements.at(-1), 'ROLLBACK');
        assert.ok(!f.statements.some(sql => sql.includes('INSERT INTO meeting_participants')));
    }
});
test('a changed actual debit rolls back the payment and admission together', async () => {
    const f = fixture({ actualBalance: 88 });
    await assert.rejects(f.service.admitMeeting('room', f.user, { pin: '1234', consent: true, maxDebit: 11 }), (error: any) => error.code === 'QUOTE_CHANGED');
    assert.equal(f.statements.at(-1), 'ROLLBACK');
    assert.ok(!f.statements.some(sql => sql.includes('INSERT INTO meeting_participants')));
});
test('ticketed events require a code bound to the authenticated account, without a second meeting charge', async () => {
    const f = fixture({ event: 'active', ticket: true });
    await assert.rejects(f.service.admitMeeting('room', f.user, { ticketCode: 'borrowed-code' }), (error: any) => error.code === 'TICKET_REQUIRED');
    assert.equal((await f.service.admitMeeting('room', f.user, { ticketCode: 'OC-personal-code' })).charged, false);
    assert.equal(f.payments.length, 0);
});
test('closed events and non-members cannot enter through the meeting link', async () => {
    const closed = fixture({ event: 'cancelled' });
    await assert.rejects(closed.service.admitMeeting('room', closed.user, {}), (error: any) => error.code === 'EVENT_CLOSED');
    const group = fixture({ meeting: { group_id: 12 } });
    await assert.rejects(group.service.admitMeeting('room', group.user, {}), (error: any) => error.code === 'GROUP_ACCESS_REQUIRED');
});
