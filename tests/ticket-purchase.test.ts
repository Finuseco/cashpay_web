import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file: string, deps: Record<string, any>) {
    const exports: any = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
        { exports, require: (id: string) => { if (!(id in deps)) throw new Error(`Unexpected dependency ${id}`); return deps[id]; }, console });
    return exports;
}
function fixture(options: any = {}) {
    const sql: string[] = []; const payments: any[] = []; const codes: string[] = []; let uid = 0;
    const connection = { release() {}, query: async (text: string, values: any[] = []) => {
        sql.push(text);
        if (text.includes('FROM event_ticket_types tt')) return { rows: String(values[1]) === '3' ? [{ id: 5, event_id: 3, price: 10, currency: 'USD', owner_user_id: 9, event_status: 'active', name: 'Formation', event_type: options.zoom ? 'zoom' : 'live', quantity_total: 2, quantity_sold: 0 }] : [] };
        if (text.includes('SELECT user_id FROM wallets')) return { rows: [{ user_id: 7 }, { user_id: 9 }] };
        if (text.includes('SELECT rate FROM exchange_rates')) return { rows: [{ rate: 2800 }] };
        if (text.includes('SELECT balances FROM wallets')) return { rows: [{ balances: { CDF: 1000000, USD: 100 } }] };
        if (text.includes('INSERT INTO tickets')) { if (options.issueFails) throw new Error('issue failed'); codes.push(values[3]); return { rows: [{ id: codes.length }] }; }
        if (text.includes('UPDATE event_ticket_types') || ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [] };
        throw new Error(`Unexpected SQL ${text}`);
    } };
    const payment = load('src/lib/payment-quote.ts', {
        '@/lib/actions/wallet.actions': { calculateTransactionFee: async () => 100 }, '@/lib/utils': { countryToCode: () => 'CD' },
    });
    const service = load('src/lib/ticket-purchase.ts', {
        crypto: { default: { randomUUID: () => `unique-${++uid}` } },
        '@/lib/db': { db: { getConnection: async () => connection } }, '@/lib/payment-quote': payment,
        '@/lib/actions/auth.actions': { verifyCurrentUserPin: async () => ({ success: options.pinValid !== false }) },
        '@/lib/actions/transaction.actions': { createTransaction: async (args: any) => { assert.equal(args.connection, connection); payments.push(args); return { success: true, transactionId: 42, senderNewBalance: 943900 }; } },
    });
    return { service, sql, payments, codes, user: { id: 7, full_name: 'Participant', country: 'CD' } };
}
test('ticket purchase converts the debit currency but credits the organizer in the event currency', async () => {
    const f = fixture();
    const quote = await f.service.quoteEventTicket(f.user, '3', 5, 2, 'CDF');
    assert.equal(quote.totalDebit, 56100);
    const result = await f.service.buyEventTickets(f.user, '3', 5, 2, 'CDF', '1234', quote.totalDebit);
    assert.equal(result.tickets.length, 2); assert.equal(new Set(f.codes).size, 2);
    assert.equal(f.payments[0].amount, 20); assert.equal(f.payments[0].currency, 'USD');
    assert.equal(f.payments[0].sourceCurrency, 'CDF'); assert.equal(f.payments[0].receiver_id, 9);
    assert.equal(f.sql.at(-1), 'COMMIT');
});
test('stock, event ownership of ticket type, PIN and legacy Zoom sales are enforced before payment', async () => {
    for (const [options, eventId, quantity] of [[{}, '3', 3], [{}, '4', 1], [{ pinValid: false }, '3', 1], [{ zoom: true }, '3', 1]] as any[]) {
        const f = fixture(options);
        await assert.rejects(f.service.buyEventTickets(f.user, eventId, 5, quantity, 'CDF', '1234', 100000));
        assert.equal(f.payments.length, 0); assert.equal(f.sql.at(-1), 'ROLLBACK');
    }
});
test('a ticket issuance failure rolls back the same transaction used for payment', async () => {
    const f = fixture({ issueFails: true });
    await assert.rejects(f.service.buyEventTickets(f.user, '3', 5, 2, 'CDF', '1234', 56100));
    assert.equal(f.payments.length, 1); assert.equal(f.sql.at(-1), 'ROLLBACK');
    assert.ok(!f.sql.includes('COMMIT'));
});
