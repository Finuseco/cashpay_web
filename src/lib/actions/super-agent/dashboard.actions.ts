'use server';

import { db } from '@/lib/db';
import { regionalScope } from '@/lib/super-agent-access';

/** Regional figures are read from the ledger; currencies are never added together. */
export async function getRegionalDashboard() {
    const scope = await regionalScope();
    const queries = {
        users: `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE LOWER(u.status) = 'active')::int AS active,
            COUNT(*) FILTER (WHERE LOWER(u.status) IN ('suspended','blocked'))::int AS blocked,
            COUNT(*) FILTER (WHERE u.role IN ('Agent','SubSuperAgent'))::int AS agents FROM users u WHERE ${scope.sql}`,
        balances: `SELECT b.key AS currency, SUM(b.value::numeric)::text AS amount FROM wallets w JOIN users u ON u.id = w.user_id
            CROSS JOIN LATERAL jsonb_each_text(COALESCE(w.balances::jsonb, '{}'::jsonb)) b
            WHERE ${scope.sql} GROUP BY b.key ORDER BY b.key`,
        monthly: `SELECT t.currency, SUM(t.amount)::text AS volume, SUM(COALESCE(t.fee,0))::text AS fees, COUNT(*)::int AS count
            FROM transactions t JOIN users u ON u.id = t.sender_id WHERE ${scope.sql}
            AND t.status = 'Completed' AND t.created_at >= date_trunc('month', CURRENT_TIMESTAMP)
            GROUP BY t.currency ORDER BY t.currency`,
        activity: `SELECT t.reference_code, t.type_code, t.amount, t.currency, t.status, t.created_at, u.full_name
            FROM transactions t JOIN users u ON u.id = COALESCE(t.sender_id,t.receiver_id)
            WHERE ${scope.sql} ORDER BY t.created_at DESC LIMIT 25`,
        deposits: `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE LOWER(t.status) = 'pending')::int AS pending
            FROM transactions t JOIN users u ON u.id = CASE WHEN t.type_code = 'DP_SUPER_AGENT' THEN t.receiver_id ELSE COALESCE(t.sender_id,t.receiver_id) END
            WHERE ${scope.sql} AND t.type_code LIKE 'DP%'`,
        orders: `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE LOWER(o.status) IN ('pending','processing'))::int AS pending
            FROM orders o JOIN users u ON u.id = o.user_id WHERE ${scope.sql}`,
        cards: `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE cr.status = 'pending')::int AS pending
            FROM card_requests cr JOIN users u ON u.id = cr.user_id WHERE ${scope.sql}`,
        tv: `SELECT COUNT(*)::int AS pending FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE ${scope.sql} AND s.status = 'pending'`,
        claims: `SELECT COUNT(*)::int AS pending FROM international_transfer_claims c JOIN users u ON u.id = c.user_id WHERE ${scope.sql} AND c.status = 'pending'`,
        checks: `SELECT COUNT(*)::int AS total FROM digital_checks c JOIN users u ON u.id = c.issuer_user_id WHERE ${scope.sql}`,
    };
    const sections = await Promise.all(Object.entries(queries).map(async ([key, query]) => {
        try { return [key, { available: true, rows: (await db.query(query, scope.values)).rows }] as const; }
        catch (error) { console.error(`[RegionalDashboard:${key}]`, error); return [key, { available: false, rows: [] }] as const; }
    }));
    return { country: scope.country, province: scope.actor.role === 'SubSuperAgent' ? scope.actor.province : null,
        generatedAt: new Date().toISOString(), sections: Object.fromEntries(sections) };
}
