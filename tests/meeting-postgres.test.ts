import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { Pool } from 'pg';
const databaseUrl = process.env.ONCHAT_TEST_DATABASE_URL;
function load(file: string, dependencies: Record<string, any>) {
    const exports: any = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
        { exports, require: (name: string) => dependencies[name] ?? (() => { throw new Error(`Unexpected dependency ${name}`); })(), console, process });
    return exports;
}
test('isolated PostgreSQL: migration, concurrent admissions, rollback and ticket stock', { skip: !databaseUrl }, async () => {
    const url = new URL(databaseUrl!);
    // This test must never connect to a configured application or production database.
    assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55439'); assert.equal(url.pathname, '/onchat_test');
    const schema = `onchat_cases_${crypto.randomBytes(6).toString('hex')}`;
    const bootstrap = new Pool({ connectionString: databaseUrl });
    await bootstrap.query(`CREATE SCHEMA ${schema}`); await bootstrap.end();
    const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, max: 5 });
    try {
        await pool.query(`CREATE TABLE users(id INTEGER PRIMARY KEY, full_name TEXT, phone TEXT, email TEXT, id_wallet TEXT);
          CREATE TABLE groups(id INTEGER PRIMARY KEY, name TEXT);
          CREATE TABLE group_members(group_id INTEGER, user_id INTEGER, status TEXT);
          CREATE TABLE meetings(id SERIAL PRIMARY KEY, host_user_id INTEGER REFERENCES users(id), topic TEXT, meeting_provider_id TEXT, join_url TEXT, type TEXT, status TEXT);
          CREATE TABLE events(id SERIAL PRIMARY KEY, owner_user_id INTEGER REFERENCES users(id), name TEXT, currency TEXT, event_type TEXT, status TEXT);
          CREATE TABLE event_ticket_types(id SERIAL PRIMARY KEY, event_id INTEGER REFERENCES events(id), type_name TEXT, price NUMERIC, quantity_total INTEGER, quantity_sold INTEGER);
          CREATE TABLE wallets(user_id INTEGER PRIMARY KEY REFERENCES users(id), balances JSONB);
          CREATE TABLE transactions(id SERIAL PRIMARY KEY, reference_code TEXT, type_code TEXT, sender_id INTEGER, receiver_id INTEGER, sender_wallet_id TEXT, receiver_wallet_id TEXT, amount NUMERIC, currency TEXT, fee NUMERIC, description TEXT, metadata JSONB, status TEXT);
          CREATE TABLE tickets(id SERIAL PRIMARY KEY, event_id INTEGER, ticket_type_id INTEGER, user_id INTEGER, ticket_code TEXT, status TEXT, validation_time TIMESTAMPTZ, purchase_transaction_id INTEGER NOT NULL REFERENCES transactions(id));
          CREATE TABLE exchange_rates(country_code TEXT, from_currency TEXT, to_currency TEXT, rate NUMERIC);`);
        await pool.query(fs.readFileSync('migrations/20261028_onchat_meeting_access.sql', 'utf8'));
        await pool.query(`INSERT INTO users(id,full_name,id_wallet) VALUES (7,'Participant','USR7'),(8,'Participant 2','USR8'),(9,'Organisateur','USR9');
          INSERT INTO wallets VALUES (7,'{"USD":100}'),(8,'{"USD":100}'),(9,'{"USD":0}');
          INSERT INTO meetings(host_user_id,topic,meeting_provider_id,type,status,price_amount,price_currency) VALUES (9,'Formation','room-paid','video','active',10,'USD');`);
        const db = { query: pool.query.bind(pool), getConnection: () => pool.connect() };
        const coreDependencies: Record<string, any> = {};
        const transactionSource = fs.readFileSync('src/lib/actions/transaction.actions.ts', 'utf8');
        for (const match of transactionSource.matchAll(/from ['"]([^'"]+)['"]/g)) coreDependencies[match[1]] = {};
        coreDependencies['@/lib/db'] = { db };
        coreDependencies['../utils'] = { generateReferenceCode: () => `TEST-${crypto.randomUUID()}`, countryToCode: () => 'CD' };
        coreDependencies['./wallet.actions'] = { calculateTransactionFee: async () => 1 };
        // Use the actual financial engine. Only fee configuration and notification providers are isolated.
        const engine = load('src/lib/actions/transaction.actions.ts', coreDependencies);
        const dependencies = { '@/lib/db': { db }, '@/lib/actions/transaction.actions': engine,
            '@/lib/actions/wallet.actions': { calculateTransactionFee: async () => 1 },
            '@/lib/actions/auth.actions': { verifyCurrentUserPin: async (pin: string) => ({ success: pin === '1234' }) },
            '@/lib/utils': { countryToCode: () => 'CD' } };
        const meeting = load('src/lib/meeting-access.ts', dependencies);
        const user = { id: 7, id_wallet: 'USR7', full_name: 'Participant', country: 'CD' };
        const body = { pin: '1234', consent: true, maxDebit: 11, currency: 'USD' };
        const joined = await Promise.all([meeting.admitMeeting('room-paid', user, body), meeting.admitMeeting('room-paid', user, body)]);
        assert.equal(joined.filter(result => result.charged).length, 1);
        assert.equal(Number((await pool.query('SELECT COUNT(*) FROM transactions')).rows[0].count), 1);
        assert.equal(Number((await pool.query('SELECT fee_paid FROM meeting_participants WHERE user_id=7')).rows[0].fee_paid), 10);
        await pool.query(`CREATE FUNCTION reject_test_admission() RETURNS trigger AS $$ BEGIN IF NEW.user_id = 8 THEN RAISE EXCEPTION 'fixture admission failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
          CREATE TRIGGER reject_admission BEFORE INSERT ON meeting_participants FOR EACH ROW EXECUTE FUNCTION reject_test_admission();`);
        await assert.rejects(meeting.admitMeeting('room-paid', { ...user, id: 8 }, body));
        assert.equal(Number((await pool.query("SELECT balances->>'USD' AS balance FROM wallets WHERE user_id=8")).rows[0].balance), 100);
        assert.equal(Number((await pool.query('SELECT COUNT(*) FROM transactions WHERE sender_id=8')).rows[0].count), 0);
        await pool.query(`INSERT INTO events(owner_user_id,name,currency,event_type,status) VALUES (9,'Accès local','USD','live','active');
          INSERT INTO event_ticket_types(event_id,type_name,price,quantity_total,quantity_sold) VALUES (1,'Standard',10,1,0);`);
        const payment = load('src/lib/payment-quote.ts', dependencies);
        const tickets = load('src/lib/ticket-purchase.ts', { ...dependencies, crypto: { default: crypto }, '@/lib/payment-quote': payment });
        const purchases = await Promise.allSettled([tickets.buyEventTickets(user, '1', 1, 1, 'USD', '1234', 11), tickets.buyEventTickets({ ...user, id: 8 }, '1', 1, 1, 'USD', '1234', 11)]);
        assert.equal(purchases.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(Number((await pool.query('SELECT quantity_sold FROM event_ticket_types WHERE id=1')).rows[0].quantity_sold), 1);
        assert.equal(Number((await pool.query('SELECT COUNT(*) FROM tickets WHERE event_id=1')).rows[0].count), 1);
    } finally { await pool.end(); }
});
