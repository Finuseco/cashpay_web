'use server';

import { db } from '@/lib/db';
import { regionalScope, requireSuperAgent, assertManagedUser } from '@/lib/super-agent-access';
import { verifyUserPin } from '../auth.actions';
import { createTransaction } from '../transaction.actions';
import { approveLoanRequest, processLoanRepayments } from '../loan.actions';
import { formatUser, generateReferenceCode, countryToCode } from '../../utils';
import { createNotification } from '../notification.actions';
import { logIntervention } from './utils';
import crypto from 'crypto';

const money = (value: any) => Math.max(0, Number.parseFloat(String(value ?? 0)) || 0);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

async function getSuperAgentContext(adminId: number, connection?: any) {
    return requireSuperAgent(adminId, connection);
}
async function assertTerritory(adminId: number, targetUserId: number, connection?: any) {
    const { actor, target } = await assertManagedUser(adminId, targetUserId, connection);
    return { admin: actor, target };
}

async function verifyAdminPin(adminId: number, pin: string, connection?: any) {
    await requireSuperAgent(adminId, connection);
    if (!pin || !/^\d{4}$/.test(String(pin))) throw new Error('PIN Super Agent invalide.');
    const conn = connection || db;
    const { rows } = await conn.query('SELECT pin_hash FROM users WHERE id = $1::integer LIMIT 1', [adminId]);
    if (!rows.length || !rows[0].pin_hash) throw new Error('PIN Super Agent non configuré.');
    const result = await verifyUserPin(adminId, String(pin));
    if (!result.success) throw new Error(result.error || 'PIN Super Agent incorrect.');
}

export async function getCountryDats(country: string) {
    const scope = await regionalScope(country);
    const { rows } = await db.query(`
        SELECT d.*, u.full_name, u.phone, u.id_wallet, u.country
        FROM term_deposits d JOIN users u ON d.user_id = u.id
        WHERE ${scope.sql}
        ORDER BY d.id DESC`, scope.values);
    return rows;
}

export async function getCountryInternationalClaims(country: string) {
    const scope = await regionalScope(country);
    const { rows } = await db.query(`
        SELECT c.*, u.full_name, u.phone, u.email, u.id_wallet, u.country
        FROM international_transfer_claims c JOIN users u ON c.user_id = u.id
        WHERE ${scope.sql}
        ORDER BY c.id DESC`, scope.values);
    return rows;
}

/**
 * Approval of international claims is intentionally kept transactional.
 * The exact settlement engine remains the source of truth when a claim has
 * a dedicated status/settlement workflow; this function only authorizes a
 * pending claim and records the intervention when the required columns exist.
 */
export async function approveInternationalClaim(claimId: number, adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await getSuperAgentContext(adminId, connection);
        await verifyAdminPin(adminId, pin, connection);
        const { rows } = await connection.query(`
            SELECT c.*, u.id AS user_id, u.country
            FROM international_transfer_claims c JOIN users u ON u.id=c.user_id
            WHERE c.id=$1 FOR UPDATE`, [claimId]);
        if (!rows.length) throw new Error('Réclamation internationale introuvable.');
        await assertTerritory(adminId, Number(rows[0].user_id), connection);
        const current = String(rows[0].status || '').toLowerCase();
        if (['approved', 'completed', 'paid', 'claimed'].includes(current)) throw new Error('Cette réclamation est déjà traitée.');
        await connection.query(`UPDATE international_transfer_claims SET status='approved' WHERE id=$1`, [claimId]);
        await logIntervention(adminId, Number(rows[0].user_id), 'INTERNATIONAL_CLAIM_APPROVE', `Approbation de la réclamation internationale #${claimId}`, connection);
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error?.message || 'Approbation impossible.' };
    } finally { connection.release(); }
}

export async function getCountryLoans(country: string) {
    const scope = await regionalScope(country);
    const { rows } = await db.query(`
        SELECT l.*, u.full_name, u.first_name, u.phone, u.email, u.id_wallet, u.country, u.province,
               COALESCE(w.balances, '{}'::jsonb) AS wallet_balances
        FROM loans l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN wallets w ON w.user_id = u.id
        WHERE ${scope.sql}
        ORDER BY CASE WHEN LOWER(l.status)='pending' THEN 0 ELSE 1 END, l.request_date DESC, l.id DESC`, scope.values);

    for (const loan of rows) {
        const [schedule, repayments] = await Promise.all([
            db.query(`SELECT id, installment_number, due_date, amount, penalty_amount, paid_amount, status
                      FROM loan_installments WHERE loan_id=$1 ORDER BY installment_number`, [loan.id]),
            db.query(`SELECT id, amount, type, payment_date, transaction_id
                      FROM loan_repayments WHERE loan_id=$1 ORDER BY payment_date DESC, id DESC`, [loan.id])
        ]);
        loan.schedule = schedule.rows.map((r: any) => ({
            id: Number(r.id), installment_number: Number(r.installment_number), due_date: new Date(r.due_date).toISOString(),
            amount: money(r.amount), penalty: money(r.penalty_amount), paid_amount: money(r.paid_amount),
            remaining_amount: roundMoney(money(r.amount) + money(r.penalty_amount) - money(r.paid_amount)), status: r.status
        }));
        loan.repayments = repayments.rows.map((r: any) => ({ ...r, amount: money(r.amount) }));
        loan.wallet_balances = typeof loan.wallet_balances === 'string' ? JSON.parse(loan.wallet_balances) : (loan.wallet_balances || {});
    }
    return rows;
}

export async function triggerCountryLoanCollection(adminId: number, pin: string) {
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const admin = await getSuperAgentContext(adminId, connection);

        // Le recouvrement global est strictement réservé au Super Agent.
        if (String(admin.role || '').trim() !== 'SuperAgent') {
            throw new Error('Accès réservé au Super Agent.');
        }

        await verifyAdminPin(adminId, pin, connection);

        if (!admin.country) {
            throw new Error('Le pays du Super Agent est introuvable.');
        }

        const { rows: loans } = await connection.query(`
            SELECT DISTINCT l.user_id
            FROM loans l
            JOIN users u ON u.id = l.user_id
            WHERE LOWER(TRIM(u.country)) = LOWER(TRIM($1))
              AND LOWER(TRIM(l.status)) = 'approved'
              AND (
                l.remaining_balance > 0
                OR EXISTS (
                  SELECT 1
                  FROM loan_installments li
                  WHERE li.loan_id = l.id
                    AND li.status <> 'paid'
                    AND li.due_date <= NOW()
                    AND (
                      COALESCE(li.amount, 0)
                      + COALESCE(li.penalty_amount, 0)
                      - COALESCE(li.paid_amount, 0)
                    ) > 0
                )
              )
            ORDER BY l.user_id
        `, [admin.country]);

        const userIds = loans.map((row: any) => Number(row.user_id));

        await connection.query('COMMIT');

        let successful = 0;
        let failed = 0;
        let processed = 0;
        let debited = 0;
        const errors: string[] = [];

        // Le moteur LoanMe existant effectue les vrais prélèvements,
        // applique les frais/pénalités configurés et ne traite que les
        // échéances dont due_date <= NOW().
        for (const userId of userIds) {
            try {
                const result = await processLoanRepayments(userId);

                const userProcessed = Number(result?.processed || 0);
                const userDebited = Number(result?.debited || 0);
                const userFailed = Number(result?.failed || 0);

                processed += userProcessed;
                debited += userDebited;
                failed += userFailed;

                if (userProcessed > 0) {
                    successful++;
                } else {
                    if (result?.error) {
                        errors.push(`Utilisateur #${userId}: ${result.error}`);
                    } else if (userFailed > 0) {
                        errors.push(`Utilisateur #${userId}: aucun prélèvement n'a abouti.`);
                    } else {
                        errors.push(`Utilisateur #${userId}: aucun prélèvement effectué.`);
                    }
                }
            } catch (error: any) {
                failed++;
                errors.push(
                    `Utilisateur #${userId}: ${error?.message || 'Recouvrement impossible.'}`
                );
            }
        }

        // Ne jamais annoncer un succès si aucune transaction de remboursement
        // n'a réellement été exécutée.
        return {
            success: processed > 0,
            country: admin.country,
            users: userIds.length,
            successful,
            failed,
            processed,
            debited,
            errors
        };
    } catch (error: any) {
        try {
            await connection.query('ROLLBACK');
        } catch {}

        return {
            success: false,
            error: error?.message || 'Recouvrement global impossible.'
        };
    } finally {
        try {
            connection.release();
        } catch {}
    }
}

export async function triggerManualLoanCollection(loanId: number, adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await verifyAdminPin(adminId, pin, connection);
        const { rows } = await connection.query(`
            SELECT l.id, l.user_id, l.status, l.currency, l.remaining_balance, u.country, u.province, u.full_name
            FROM loans l JOIN users u ON u.id=l.user_id WHERE l.id=$1 FOR UPDATE`, [loanId]);
        if (!rows.length) throw new Error('Prêt introuvable.');
        await assertTerritory(adminId, Number(rows[0].user_id), connection);
        if (String(rows[0].status).toLowerCase() !== 'approved') throw new Error('Seul un prêt approuvé peut faire l’objet d’un recouvrement.');
        if (money(rows[0].remaining_balance) <= 0.005) throw new Error('Ce prêt est déjà soldé.');
        await connection.query('COMMIT');

        // Le moteur LoanMe existant gère le débit, les échéances et les pénalités.
        const result = await processLoanRepayments(Number(rows[0].user_id));
        if (!result.success) return result;
        const logConnection = await db.getConnection();
        try {
            await logIntervention(adminId, Number(rows[0].user_id), 'LOAN_MANUAL_COLLECTION', `Recouvrement manuel du prêt #${loanId}`, logConnection);
        } finally {
            logConnection.release();
        }
        return { ...result, loanId };
    } catch (error: any) {
        try { await connection.query('ROLLBACK'); } catch {}
        return { success: false, error: error?.message || 'Recouvrement impossible.' };
    } finally { connection.release(); }
}

export async function processLoanDecision(loanId: number, decision: string, adminId: number, pin: string) {
    const normalized = String(decision || '').toLowerCase();
    if (!['approve', 'reject'].includes(normalized)) {
        return { success: false, error: 'Décision LoanMe invalide.' };
    }

    // IMPORTANT:
    // Do not keep a pool connection checked out while approveLoanRequest()
    // opens its own transaction/connection. The previous implementation
    // committed here but kept the connection until the function returned,
    // which could exhaust a small PostgreSQL pool and leave the Super Agent
    // request waiting indefinitely.
    const connection = await db.getConnection();
    let targetUserId: number | null = null;

    try {
        await connection.query('BEGIN');
        await verifyAdminPin(adminId, pin, connection);

        const { rows } = await connection.query(
            `SELECT l.id,l.user_id,l.status,u.country,u.province
             FROM loans l
             JOIN users u ON u.id=l.user_id
             WHERE l.id=$1
             FOR UPDATE`,
            [loanId]
        );

        if (!rows.length) throw new Error('Demande de prêt introuvable.');

        targetUserId = Number(rows[0].user_id);
        await assertTerritory(adminId, targetUserId, connection);

        if (String(rows[0].status).toLowerCase() !== 'pending') {
            throw new Error('Cette demande a déjà été traitée.');
        }

        await connection.query('COMMIT');
    } catch (error: any) {
        try { await connection.query('ROLLBACK'); } catch {}
        return { success: false, error: error?.message || 'Décision LoanMe impossible.' };
    } finally {
        // Release BEFORE calling approveLoanRequest(), which obtains its
        // own connection and transaction.
        connection.release();
    }

    if (!targetUserId) {
        return { success: false, error: 'Utilisateur du prêt introuvable.' };
    }

    try {
        if (normalized === 'approve') {
            const result = await approveLoanRequest(loanId, adminId);

            if (!result.success) {
                return result;
            }

            const logConnection = await db.getConnection();
            try {
                await logIntervention(
                    adminId,
                    targetUserId,
                    'LOAN_APPROVE',
                    `Approbation du prêt #${loanId}`,
                    logConnection
                );
            } finally {
                logConnection.release();
            }

            await createNotification(
                targetUserId,
                'Demande LoanMe approuvée',
                `Votre demande de prêt #${loanId} a été approuvée.`,
                'new_message',
                { type: 'loan_approved', loan_id: loanId }
            );

            return { success: true };
        }

        // Rejection is performed in a fresh transaction. The validation
        // connection above has already been released.
        const rejectConn = await db.getConnection();
        try {
            await rejectConn.query('BEGIN');

            const { rows: locked } = await rejectConn.query(
                `SELECT l.user_id,u.full_name,u.phone,u.email
                 FROM loans l
                 JOIN users u ON u.id=l.user_id
                 WHERE l.id=$1 AND l.status='pending'
                 FOR UPDATE`,
                [loanId]
            );

            if (!locked.length) throw new Error('Demande déjà traitée.');

            await assertTerritory(adminId, Number(locked[0].user_id), rejectConn);

            await rejectConn.query(
                `UPDATE loans SET status='rejected' WHERE id=$1`,
                [loanId]
            );

            await logIntervention(
                adminId,
                Number(locked[0].user_id),
                'LOAN_REJECT',
                `Rejet du prêt #${loanId}`,
                rejectConn
            );

            await rejectConn.query('COMMIT');

            await createNotification(
                Number(locked[0].user_id),
                'Demande LoanMe rejetée',
                `Votre demande de prêt #${loanId} a été rejetée.`,
                'new_message',
                { type: 'loan_rejected', loan_id: loanId }
            );

            return { success: true };
        } catch (error: any) {
            try { await rejectConn.query('ROLLBACK'); } catch {}
            return { success: false, error: error?.message || 'Rejet LoanMe impossible.' };
        } finally {
            rejectConn.release();
        }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Décision LoanMe impossible.' };
    }
}
export async function updateCountryExchangeRate(data: any) {
    const countryCode = String(data?.country_code ?? data?.countryCode ?? '').trim().toUpperCase();
    const fromCurrency = String(data?.from_currency ?? data?.fromCurrency ?? '').trim().toUpperCase();
    const toCurrency = String(data?.to_currency ?? data?.toCurrency ?? '').trim().toUpperCase();
    const rate = Number(data?.rate);
    const adminId = Number(data?.adminId ?? data?.admin_id);
    const pin = String(data?.pin ?? '');
    if (!countryCode || !fromCurrency || !toCurrency || !Number.isFinite(rate) || rate <= 0 || !adminId) return { success: false, error: 'Paramètres de taux invalides.' };
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await verifyAdminPin(adminId, pin, connection);
        const admin = await getSuperAgentContext(adminId, connection);
        if (admin.role === 'SubSuperAgent') throw new Error('Un sous-super-agent ne peut pas modifier les taux de change.');
        const adminCode = countryToCode(admin.country) || String(admin.country || '').toUpperCase();
        if (admin.role !== 'Admin' && adminCode !== countryCode && String(admin.country || '').toUpperCase() !== countryCode) throw new Error('Le taux demandé est hors du territoire du Super Agent.');
        const countryInfo = (await import('@/lib/countries')).countries.find(item => item.code === countryCode);
        const local = countryInfo?.currency_code;
        if (!local || fromCurrency === toCurrency || ![fromCurrency, toCurrency].every(code => /^[A-Z]{3,10}$/.test(code))) throw new Error('Paire de devises invalide.');
        if (admin.role !== 'Admin' && (!([fromCurrency, toCurrency].includes(local)) || [fromCurrency, toCurrency].some(code => code !== local && !['USD', 'EUR'].includes(code)))) throw new Error('Seules les paires entre la devise locale et USD/EUR sont modifiables.');
        await connection.query(`
            INSERT INTO exchange_rates (country_code, from_currency, to_currency, rate)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (country_code, from_currency, to_currency)
            DO UPDATE SET rate=EXCLUDED.rate`, [countryCode, fromCurrency, toCurrency, rate]);
        await logIntervention(adminId, adminId, 'EXCHANGE_RATE_UPDATE', `Taux ${fromCurrency}/${toCurrency} = ${rate} pour ${countryCode}`, connection);
        await connection.query('COMMIT');
        return { success: true, data: { country_code: countryCode, from_currency: fromCurrency, to_currency: toCurrency, rate } };
    } catch (error: any) { await connection.query('ROLLBACK'); return { success: false, error: error?.message || 'Mise à jour du taux impossible.' }; }
    finally { connection.release(); }
}

export async function getUserTransactionsForSuperAgent(userId: number, adminId?: number) {
    const actor = await requireSuperAgent(adminId);
    await assertTerritory(actor.id, userId);
    const { rows } = await db.query(`
        SELECT t.*, s.full_name AS sender_name, r.full_name AS receiver_name,
               s.id_wallet AS sender_wallet, r.id_wallet AS receiver_wallet
        FROM transactions t
        LEFT JOIN users s ON s.id=t.sender_id
        LEFT JOIN users r ON r.id=t.receiver_id
        WHERE (t.sender_id=$1::integer OR t.receiver_id=$1::integer)
          AND t.status IN ('Completed','Pending','Reversed','Failed')
        ORDER BY t.created_at DESC, t.id DESC`, [userId]);
    return rows;
}

export async function superAgentDeposit(data: any) {
    const adminId = Number(data?.adminId ?? data?.admin_id);
    const targetUserId = Number(data?.targetUserId ?? data?.target_user_id);
    const amount = roundMoney(Number(data?.amount));
    const currency = String(data?.currency || '').trim().toUpperCase();
    const pin = String(data?.pin || '');
    if (!adminId || !targetUserId || !Number.isFinite(amount) || amount <= 0 || !currency) return { success: false, error: 'Paramètres de dépôt invalides.' };

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { admin, target } = await assertTerritory(adminId, targetUserId, connection);
        await verifyAdminPin(adminId, pin, connection);
        if (String(target.id) === String(admin.id)) throw new Error('Le Super Agent ne peut pas se créditer lui-même par cette opération.');
        const { rows: walletRows } = await connection.query(`SELECT user_id, balances FROM wallets WHERE user_id IN ($1::integer,$2::integer) FOR UPDATE`, [adminId, targetUserId]);
        const adminWallet = walletRows.find((w: any) => Number(w.user_id) === adminId);
        const targetWallet = walletRows.find((w: any) => Number(w.user_id) === targetUserId);
        if (!adminWallet || !targetWallet) throw new Error('Portefeuille Super Agent ou client introuvable.');
        const adminBalances = typeof adminWallet.balances === 'string' ? JSON.parse(adminWallet.balances) : (adminWallet.balances || {});
        const targetBalances = typeof targetWallet.balances === 'string' ? JSON.parse(targetWallet.balances) : (targetWallet.balances || {});
        const available = money(adminBalances[currency]);
        if (available + 0.005 < amount) throw new Error(`Solde Super Agent insuffisant en ${currency}. Disponible: ${available.toFixed(2)} ${currency}.`);
        adminBalances[currency] = roundMoney(available - amount);
        targetBalances[currency] = roundMoney(money(targetBalances[currency]) + amount);
        await connection.query('UPDATE wallets SET balances=$1::jsonb WHERE user_id=$2::integer', [JSON.stringify(adminBalances), adminId]);
        await connection.query('UPDATE wallets SET balances=$1::jsonb WHERE user_id=$2::integer', [JSON.stringify(targetBalances), targetUserId]);
        const reference = generateReferenceCode('SA_DP');
        const { rows: txRows } = await connection.query(`
            INSERT INTO transactions (reference_code,type_code,status,amount,currency,fee,description,sender_id,receiver_id,sender_wallet_id,receiver_wallet_id,metadata)
            VALUES ($1,'DP_SUPER_AGENT','Completed',$2,$3,0,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id`, [
            reference, amount, currency, `Dépôt Super Agent pour ${target.full_name || 'Client'}`,
            adminId, targetUserId, admin.id_wallet || null, target.id_wallet || null,
            JSON.stringify({ admin_id: adminId, target_user_id: targetUserId, territory: admin.country, fee: 0 })
        ]);
        await logIntervention(adminId, targetUserId, 'SUPER_AGENT_DEPOSIT', `Dépôt de ${amount.toFixed(2)} ${currency} — Réf ${reference}`, connection);
        await connection.query('COMMIT');
        await createNotification(targetUserId, 'Dépôt reçu', `Votre portefeuille a été crédité de ${amount.toFixed(2)} ${currency} par votre Super Agent. Réf: ${reference}.`, 'general', { reference, amount, currency }).catch(error => console.error('[SUPER_AGENT_DEPOSIT_NOTIFICATION]', error));
        return { success: true, reference, transactionId: txRows[0]?.id, senderNewBalance: adminBalances[currency], receiverNewBalance: targetBalances[currency], fee: 0 };
    } catch (error: any) { await connection.query('ROLLBACK'); return { success: false, error: error?.message || 'Dépôt Super Agent impossible.' }; }
    finally { connection.release(); }
}

export async function getClientBalancesForAdmin(userId: number, adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await assertTerritory(adminId, userId, connection);
        await verifyAdminPin(adminId, pin, connection);
        const { rows } = await connection.query(`SELECT balances, commission_balance FROM wallets WHERE user_id=$1::integer LIMIT 1`, [userId]);
        if (!rows.length) throw new Error('Portefeuille client introuvable.');
        const balances = typeof rows[0].balances === 'string' ? JSON.parse(rows[0].balances) : (rows[0].balances || {});
        const commission = typeof rows[0].commission_balance === 'string' ? JSON.parse(rows[0].commission_balance) : (rows[0].commission_balance || {});
        await connection.query('COMMIT');
        return { success: true, balances, commission_balance: commission };
    } catch (error: any) { await connection.query('ROLLBACK'); return { success: false, error: error?.message || 'Impossible de récupérer le solde.' }; }
    finally { connection.release(); }
}

export async function resetBusinessApiKey(partnerId: number, type: string, adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await verifyAdminPin(adminId, pin, connection);
        const { rows } = await connection.query(`SELECT owner_user_id, company_name FROM b2b_partners WHERE id=$1 FOR UPDATE`, [partnerId]);
        if (!rows.length) throw new Error('Partenaire B2B introuvable.');
        await assertTerritory(adminId, Number(rows[0].owner_user_id), connection);
        const isTest = String(type || '').toLowerCase() === 'test';
        const apiKey = `cp_${isTest ? 'test' : 'live'}_${crypto.randomBytes(12).toString('hex')}`;
        const apiSecret = `csk_${isTest ? 'test' : 'live'}_${crypto.randomBytes(24).toString('hex')}`;
        if (isTest) {
            await connection.query('UPDATE users SET test_api_key=$1,test_api_secret=$2 WHERE id=$3', [apiKey, apiSecret, rows[0].owner_user_id]);
        } else {
            await connection.query('UPDATE users SET api_key=$1,api_secret=$2 WHERE id=$3', [apiKey, apiSecret, rows[0].owner_user_id]);
            await connection.query('UPDATE b2b_partners SET api_key=$1 WHERE id=$2', [apiKey, partnerId]);
        }
        await logIntervention(adminId, Number(rows[0].owner_user_id), 'B2B_API_KEY_RESET', `Réinitialisation de la clé API ${isTest ? 'Test' : 'Live'} du partenaire #${partnerId}`, connection);
        await connection.query('COMMIT');
        return { success: true, apiKey, apiSecret, type: isTest ? 'test' : 'live' };
    } catch (error: any) { await connection.query('ROLLBACK'); return { success: false, error: error?.message || 'Réinitialisation API impossible.' }; }
    finally { connection.release(); }
}

export async function getCountryRevenueWallet(country: string) {
    const scope = await regionalScope(country);
    const { rows } = await db.query(`SELECT w.id, w.id_wallet, w.balances, u.full_name, u.country, u.role
        FROM wallets w JOIN users u ON u.id = w.user_id
        WHERE ${scope.sql} AND (UPPER(COALESCE(u.role::text,'')) LIKE '%REVENUE%' OR UPPER(COALESCE(u.account_type::text,'')) LIKE '%REVENUE%')
        ORDER BY w.id DESC LIMIT 1`, scope.values);
    return rows[0] || null;
}

export async function getCountryPayouts(country: string) {
    const scope = await regionalScope(country);
    const { rows } = await db.query(`
        SELECT t.*, u.full_name, u.country, u.id_wallet
        FROM transactions t LEFT JOIN users u ON u.id=t.sender_id
        WHERE t.type_code LIKE 'WD_%' AND ${scope.sql}
        ORDER BY t.created_at DESC, t.id DESC`, scope.values);
    return rows;
}

export async function getCountryPendingDeposits(country: string) {
    const scope = await regionalScope(country);
    const { rows } = await db.query(`
        SELECT t.*, u.full_name, u.country, u.id_wallet
        FROM transactions t LEFT JOIN users u ON u.id=t.sender_id
        WHERE t.type_code LIKE 'DP%' AND LOWER(t.status)='pending'
          AND ${scope.sql}
        ORDER BY t.created_at DESC, t.id DESC`, scope.values);
    return rows;
}

export async function getCountryExchangeRates(code: string) {
    await regionalScope(code);
    const { rows } = await db.query(`SELECT * FROM exchange_rates WHERE country_code = $1 ORDER BY from_currency,to_currency`, [code]);
    return { success: true, data: rows };
}

export async function getCountryBusinessPartners(country: string) {
    const scope = await regionalScope(country);
    const { rows } = await db.query(`
        SELECT p.*, u.full_name, u.phone, u.email, u.id_wallet, u.country
        FROM b2b_partners p JOIN users u ON p.owner_user_id = u.id
        WHERE ${scope.sql} ORDER BY p.id DESC`, scope.values);
    return { b2b: rows };
}

export async function processDatDecision(datId: number, decision: string, adminId: number, pin: string) {
    const normalized = String(decision || '').toLowerCase();
    if (!['approve', 'reject'].includes(normalized)) return { success: false, error: 'Décision DAT invalide.' };
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await verifyAdminPin(adminId, pin, connection);
        const { rows } = await connection.query(`SELECT d.*,u.id AS user_id,u.country FROM term_deposits d JOIN users u ON u.id=d.user_id WHERE d.id=$1 FOR UPDATE`, [datId]);
        if (!rows.length) throw new Error('Dépôt à terme introuvable.');
        await assertTerritory(adminId, Number(rows[0].user_id), connection);
        const status = String(rows[0].status || '').toLowerCase();
        if (!['pending', 'requested', 'submitted'].includes(status)) throw new Error('Ce DAT a déjà été traité.');
        await connection.query('UPDATE term_deposits SET status=$1 WHERE id=$2', [normalized === 'approve' ? 'approved' : 'rejected', datId]);
        await logIntervention(adminId, Number(rows[0].user_id), `DAT_${normalized.toUpperCase()}`, `${normalized === 'approve' ? 'Approbation' : 'Rejet'} du DAT #${datId}`, connection);
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) { await connection.query('ROLLBACK'); return { success: false, error: error?.message || 'Décision DAT impossible.' }; }
    finally { connection.release(); }
}
