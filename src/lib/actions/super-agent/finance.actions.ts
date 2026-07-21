
'use server';

import { db } from '@/lib/db';
import { handleDbError } from '../helpers';
import { createTransaction } from '../transaction.actions';
import { validateSuperAgentAccess, logIntervention } from './utils';
import * as bcrypt from 'bcryptjs';
import { countryToCode, generateReferenceCode, formatUser } from '@/lib/utils';
import { calculateTransactionFee } from '../wallet.actions';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { format } from 'date-fns';
import type { Transaction } from '@/lib/types';
import crypto from 'crypto';

/**
 * Récupère les statistiques de performance pour le pays du Super Agent.
 */
export async function getSuperAgentStats(countryName: string, role: string) {
    try {
        const { rows: users } = await db.query('SELECT COUNT(*) FROM users WHERE country = $1', [countryName]);
        const { rows: products } = await db.query('SELECT COUNT(*) FROM products p JOIN users u ON p.agent_id = u.id WHERE u.country = $1', [countryName]);
        const { rows: orders } = await db.query("SELECT COUNT(*) FROM orders o JOIN users u ON o.user_id = u.id WHERE u.country = $1 AND o.status != 'delivered'", [countryName]);
        
        const { rows: volumes } = await db.query(`
            SELECT currency, SUM(amount) as total 
            FROM transactions t 
            JOIN users u ON t.sender_id = u.id 
            WHERE u.country = $1 AND t.status = 'Completed' 
            GROUP BY currency
        `, [countryName]);

        let revenue = [];
        if (role === 'SuperAgent' || role === 'Admin') {
            const { rows: revRows } = await db.query(`
                SELECT currency, SUM(fee) as total_fees
                FROM transactions t
                JOIN users u ON t.sender_id = u.id
                WHERE u.country = $1 AND t.status = 'Completed'
                GROUP BY currency
            `, [countryName]);
            revenue = revRows.map(r => ({ currency: r.currency, total: parseFloat(r.total_fees) }));
        }

        return { 
            users: parseInt(users[0].count), 
            activeProducts: parseInt(products[0].count), 
            pendingOrders: parseInt(orders[0].count), 
            volumes: volumes.map(v => ({ currency: v.currency, total: parseFloat(v.total) })),
            revenue: revenue
        };
    } catch (e) {
        return { users: 0, activeProducts: 0, pendingOrders: 0, volumes: [], revenue: [] };
    }
}

export async function getCountryRevenueWallet(countryName: string) {
    const code = countryToCode(countryName);
    try {
        const { rows } = await db.query(`
            SELECT rw.wallet_id, w.balances, u.full_name as "walletName"
            FROM revenue_wallets rw
            JOIN wallets w ON rw.wallet_id = w.id_wallet
            JOIN users u ON w.user_id = u.id
            WHERE rw.country_code = $1 AND rw.is_active = true
            LIMIT 1
        `, [code || 'GBL']);
        if (rows.length === 0) return null;
        return {
            id: rows[0].wallet_id,
            name: rows[0].walletName,
            balances: typeof rows[0].balances === 'string' ? JSON.parse(rows[0].balances) : rows[0].balances
        };
    } catch (e) {
        return null;
    }
}

/**
 * Récupère le flux d'activité national complet.
 */
export async function getCountryActivityFeed(countryName: string) {
    try {
        const { rows } = await db.query(`
            SELECT 'user_reg' as type, full_name as label, 'Nouvel utilisateur inscrit' as detail, created_at as timestamp 
            FROM users 
            WHERE country = $1
            
            UNION ALL
            
            SELECT 'transaction' as type, description as label, amount || ' ' || currency as detail, t.created_at as timestamp 
            FROM transactions t 
            WHERE EXISTS (
                SELECT 1 FROM users u 
                WHERE (u.id = t.sender_id OR u.id = t.receiver_id) 
                AND u.country = $1
            )
            
            UNION ALL
            
            SELECT 'card_req' as type, u.full_name as label, 'Commande carte ' || cr.brand as detail, cr.created_at as timestamp
            FROM card_requests cr
            JOIN users u ON cr.user_id = u.id
            WHERE u.country = $1
            
            UNION ALL
            
            SELECT 'intl_claim' as type, u.full_name as label, 'Réclame transfert ' || provider as detail, itc.created_at as timestamp
            FROM international_transfer_claims itc
            JOIN users u ON itc.user_id = u.id
            WHERE u.country = $1
            
            UNION ALL
            
            SELECT 'loan' as type, u.full_name as label, 'Demande de prêt de ' || amount || ' ' || currency as detail, l.created_at as timestamp
            FROM loans l
            JOIN users u ON l.user_id = u.id
            WHERE u.country = $1

            ORDER BY timestamp DESC 
            LIMIT 30
        `, [countryName]);
        
        return rows.map(r => ({
            ...r,
            timestamp: new Date(r.timestamp).toISOString()
        }));
    } catch (e) {
        console.error("[getCountryActivityFeed] Error:", e);
        return [];
    }
}

/**
 * Historique des transactions d'un utilisateur spécifique.
 */
export async function getUserTransactionsForSuperAgent(userId: number): Promise<Transaction[]> {
    try {
        const { rows } = await db.query(`
            SELECT t.*, s.full_name as sender_name, r.full_name as receiver_name 
            FROM transactions t
            LEFT JOIN users s ON t.sender_id = s.id
            LEFT JOIN users r ON t.receiver_id = r.id
            WHERE t.sender_id = $1 OR t.receiver_id = $1
            ORDER BY t.created_at DESC LIMIT 50
        `, [userId]);

        return rows.map(row => ({
            type: row.sender_id === userId ? 'sent' : 'received',
            description: row.description,
            date: format(new Date(row.created_at), 'dd/MM/yyyy'),
            time: format(new Date(row.created_at), 'HH:mm'),
            amount: parseFloat(row.amount).toFixed(2),
            currency: row.currency,
            reference: row.reference_code,
            fee: parseFloat(row.fee || 0),
            metadata: { 
                ...row.metadata, 
                senderName: row.sender_name, 
                receiverName: row.receiver_name,
                status: row.status 
            }
        })) as Transaction[];
    } catch (error) {
        console.error("[getUserTransactionsForSuperAgent] Error:", error);
        return [];
    }
}

export async function getClientBalancesForAdmin(targetUserId: number, adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        await validateSuperAgentAccess(adminId, targetUserId, connection);
        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [adminId]);
        if (adminRows.length === 0 || !(await bcrypt.compare(pin, adminRows[0].pin_hash))) throw new Error("PIN Super Agent incorrect.");
        const { rows: walletRows } = await connection.query('SELECT balances FROM wallets WHERE user_id = $1 FOR UPDATE', [targetUserId]);
        const balances = typeof walletRows[0]?.balances === 'string' ? JSON.parse(walletRows[0].balances) : (walletRows[0]?.balances || {});
        await logIntervention(adminId, targetUserId, 'BALANCE_VIEW', 'Consultation des soldes confidentiels', connection);
        await connection.query('COMMIT');
        return { success: true, balances };
    } catch (error: any) {
        if (connection) await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally { if (connection) connection.release(); }
}

export async function getClientLoanCycles(userId: number) {
    try {
        const { rows } = await db.query('SELECT * FROM loans WHERE user_id = $1 ORDER BY request_date DESC', [userId]);
        return rows;
    } catch (e) { return []; }
}

export async function processDatDecision(datId: number, action: 'approve' | 'reject', adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [adminId]);
        if (!(await bcrypt.compare(pin, adminRows[0].pin_hash))) throw new Error("PIN admin incorrect.");
        const status = action === 'approve' ? 'approved' : 'rejected';
        await connection.query(`UPDATE term_deposits SET status = $1, approved_at = NOW(), admin_id = $2 WHERE id = $3`, [status, adminId, datId]);
        await logIntervention(adminId, null, `DAT_${status.toUpperCase()}`, `Décision sur DAT #${datId}`, connection);
        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}

/**
 * Prend une décision (Approuver/Rejeter) sur une demande de prêt.
 */
export async function processLoanDecision(loanId: number, action: 'approve' | 'reject', adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [adminId]);
        if (!(await bcrypt.compare(pin, adminRows[0].pin_hash))) throw new Error("PIN admin incorrect.");
        
        if (action === 'approve') {
            const { rows: loanRows } = await connection.query(`
                SELECT l.*, u.id as user_id, u.full_name, u.phone, u.email, u.first_name, u.country, u.id_wallet 
                FROM loans l 
                JOIN users u ON l.user_id = u.id 
                WHERE l.id = $1 AND l.status = 'pending'
            `, [loanId]);
            
            if (loanRows.length === 0) throw new Error("Demande de prêt non trouvée.");
            const loan = loanRows[0];
            const totalRepayment = parseFloat(loan.amount) * (1 + (parseFloat(loan.interest_rate) / 100 * loan.duration));
            
            await connection.query("UPDATE loans SET status = 'approved', approval_date = NOW(), remaining_balance = $1 WHERE id = $2", [totalRepayment, loanId]);
            
            const txResult = await createTransaction({
                user: formatUser(loan), typeCode: 'LP', amount: parseFloat(loan.amount), currency: loan.currency,
                description: `Décaissement prêt #${loanId}`, metadata: { loan_id: loanId, admin_id: adminId },
                status: 'Completed', connection
            });

            if (!txResult.success) throw new Error(txResult.error);
        } else {
            await connection.query("UPDATE loans SET status = 'rejected' WHERE id = $1", [loanId]);
        }
        
        await logIntervention(adminId, null, `LOAN_${action.toUpperCase()}`, `Décision ${action} sur prêt #${loanId}`, connection);
        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}

export async function getCountryLoans(countryName: string) {
    try {
        const { rows: loans } = await db.query(`
            SELECT l.*, u.full_name, u.phone, u.country
            FROM loans l 
            JOIN users u ON l.user_id = u.id 
            WHERE u.country = $1 
            ORDER BY l.request_date DESC
        `, [countryName]);

        for (let loan of loans) {
            const { rows: repayments } = await db.query('SELECT * FROM loan_repayments WHERE loan_id = $1 ORDER BY payment_date DESC', [loan.id]);
            loan.repayments = repayments;
        }
        return loans;
    } catch (e) { return []; }
}

export async function triggerManualLoanCollection(loanId: number, adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [adminId]);
        if (!(await bcrypt.compare(pin, adminRows[0].pin_hash))) throw new Error("PIN Super Agent incorrect.");

        const { rows: loanRows } = await connection.query(`
            SELECT l.*, u.id as user_id, u.full_name, u.phone, u.email, u.country, u.id_wallet 
            FROM loans l JOIN users u ON l.user_id = u.id 
            WHERE l.id = $1 FOR UPDATE`, [loanId]);
        
        if (loanRows.length === 0) throw new Error("Prêt non trouvé.");
        const loan = loanRows[0];
        const monthlyPayment = parseFloat(loan.monthly_payment);
        const currency = loan.currency;

        const { rows: walletRows } = await connection.query('SELECT balances FROM wallets WHERE user_id = $1 FOR UPDATE', [loan.user_id]);
        const balances = walletRows[0].balances;
        const currentBalance = parseFloat(balances[currency] || '0');

        if (currentBalance >= monthlyPayment) {
            const txResult = await createTransaction({
                user: formatUser(loan), typeCode: 'LR', amount: monthlyPayment, currency,
                description: `Remboursement manuel prêt #${loan.id} par Agent`,
                metadata: { loan_id: loan.id, admin_id: adminId }, connection
            });

            if (txResult.success) {
                await connection.query('UPDATE loans SET remaining_balance = remaining_balance - $1 WHERE id = $2', [monthlyPayment, loanId]);
                await connection.query('INSERT INTO loan_repayments (loan_id, amount, type) VALUES ($1, $2, $3)', [loanId, monthlyPayment, 'repayment']);
                await logIntervention(adminId, loan.user_id, 'LOAN_COLLECT', `Recouvrement manuel de ${monthlyPayment} ${currency}`, connection);
            }
        } else {
            const penaltyFee = await calculateTransactionFee(monthlyPayment, currency, 'PENALTY', loan.country, connection);
            await connection.query('UPDATE loans SET remaining_balance = remaining_balance + $1 WHERE id = $2', [penaltyFee, loanId]);
            await connection.query('INSERT INTO loan_repayments (loan_id, amount, type) VALUES ($1, $2, $3)', [loanId, penaltyFee, 'penalty']);
            if (loan.phone) await sendSms(loan.phone, `CashPay Alerte: Échéance impayée. Pénalité de ${penaltyFee.toFixed(2)} ${currency} ajoutée à votre dette.`).catch(console.error);
            await logIntervention(adminId, loan.user_id, 'LOAN_PENALTY', `Pénalité de ${penaltyFee} ${currency} appliquée (Solde insuffisant)`, connection);
        }

        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { if (connection) connection.release(); }
}

export async function approveInternationalClaim(claimId: number, adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [adminId]);
        if (!(await bcrypt.compare(pin, adminRows[0].pin_hash))) throw new Error("PIN admin incorrect.");
        await connection.query("UPDATE international_transfer_claims SET status = 'approved', processed_at = NOW(), admin_id = $1 WHERE id = $2", [adminId, claimId]);
        await logIntervention(adminId, null, 'INTL_CLAIM_APPROVE', `Validation transfert international #${claimId}`, connection);
        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { if (connection) connection.release(); }
}

export async function getCountryExchangeRates(countryCode: string) {
    const { rows } = await db.query('SELECT * FROM exchange_rates WHERE country_code = $1', [countryCode]);
    return { success: true, data: rows };
}

/**
 * Met à jour un taux de change et lie structurellement l'action à l'audit souverain.
 */
export async function updateCountryExchangeRate(args: { countryCode: string, fromCurrency: string, toCurrency: string, newRate: number, userId: number }) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: userRows } = await connection.query('SELECT role FROM users WHERE id = $1', [args.userId]);
        if (userRows.length === 0 || userRows[0].role === 'SubSuperAgent') {
            throw new Error("Action interdite : Seul le Super Agent National peut modifier les taux.");
        }

        // Récupérer l'ancien taux pour l'audit
        const { rows: oldRateRows } = await connection.query(
            'SELECT rate FROM exchange_rates WHERE country_code = $1 AND from_currency = $2 AND to_currency = $3',
            [args.countryCode, args.fromCurrency, args.toCurrency]
        );
        const oldRate = oldRateRows[0]?.rate || 'N/A';

        // Mise à jour structurelle
        await connection.query(`
            INSERT INTO exchange_rates (country_code, from_currency, to_currency, rate) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (country_code, from_currency, to_currency) 
            DO UPDATE SET rate = EXCLUDED.rate, updated_at = NOW()
        `, [args.countryCode, args.fromCurrency, args.toCurrency, args.newRate]);

        // Liaison avec la table des interventions (Relation structurelle)
        await logIntervention(
            args.userId, 
            null, 
            'RATE_UPDATE', 
            `Mise à jour taux ${args.fromCurrency}/${args.toCurrency} : ${oldRate} -> ${args.newRate}`, 
            connection
        );

        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

export async function getCountryPayouts(countryName: string) {
    const { rows } = await db.query(`SELECT t.*, u.full_name FROM transactions t JOIN users u ON t.sender_id = u.id WHERE u.country = $1 AND t.type_code LIKE 'WD_%' ORDER BY t.created_at DESC LIMIT 100`, [countryName]);
    return rows;
}

export async function getCountryPendingDeposits(countryName: string) {
    const { rows } = await db.query(`SELECT t.*, u.full_name FROM transactions t JOIN users u ON t.sender_id = u.id WHERE u.country = $1 AND t.status = 'Pending' AND t.type_code LIKE 'DP%' ORDER BY t.created_at DESC LIMIT 100`, [countryName]);
    return rows;
}

export async function getCountryBusinessPartners(countryName: string) {
    const { rows: b2b } = await db.query("SELECT * FROM b2b_partners p JOIN users u ON p.owner_user_id = u.id WHERE u.country = $1", [countryName]);
    return { b2b, merchants: [] };
}

/**
 * Réinitialise les clés API d'un partenaire B2B.
 */
export async function resetBusinessApiKey(partnerId: number, type: 'b2b', adminId: number, pin: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Vérifier le PIN admin
        const { rows: adminRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [adminId]);
        if (adminRows.length === 0 || !(await bcrypt.compare(pin, adminRows[0].pin_hash))) {
            throw new Error("PIN Super Agent incorrect.");
        }

        // 2. Générer les nouvelles clés
        const apiKey = `cp_live_${crypto.randomBytes(12).toString('hex')}`;
        const apiSecret = `csk_live_${crypto.randomBytes(24).toString('hex')}`;
        const testApiKey = `cp_test_${crypto.randomBytes(12).toString('hex')}`;
        const testApiSecret = `csk_test_${crypto.randomBytes(24).toString('hex')}`;

        // 3. Mettre à jour l'utilisateur propriétaire
        const { rows: partnerRows } = await connection.query('SELECT owner_user_id, company_name FROM b2b_partners WHERE id = $1', [partnerId]);
        if (partnerRows.length === 0) throw new Error("Partenaire introuvable.");
        const ownerUserId = partnerRows[0].owner_user_id;
        const companyName = partnerRows[0].company_name;

        await connection.query(`
            UPDATE users 
            SET api_key = $1, api_secret = $2, test_api_key = $3, test_api_secret = $4 
            WHERE id = $5`, 
            [apiKey, apiSecret, testApiKey, testApiSecret, ownerUserId]
        );

        // 4. Mettre à jour la table b2b_partners (clé live principale)
        await connection.query('UPDATE b2b_partners SET api_key = $1 WHERE id = $2', [apiKey, partnerId]);

        // 5. Log intervention
        await logIntervention(adminId, ownerUserId, 'API_KEY_RESET', `Réinitialisation des clés API (Live & Test) pour ${companyName}`, connection);

        await connection.query('COMMIT');

        // 6. Envoyer l'email de notification
        const { rows: userRows } = await db.query('SELECT email FROM users WHERE id = $1', [ownerUserId]);
        if (userRows[0]?.email) {
            await sendEmail(userRows[0].email, "Vos nouvelles clés API CashPay", 'b2b_welcome', {
                companyName: companyName,
                apiKey: apiKey,
                testApiKey: testApiKey,
                testApiSecret: testApiSecret,
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
            });
        }

        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

/**
 * Effectue un dépôt direct (Souverain) sans frais depuis le compte du Super Agent vers un client.
 */
export async function superAgentDeposit(args: {
    adminId: number;
    targetUserId: number;
    amount: number;
    currency: string;
    pin: string;
}) {
    const { adminId, targetUserId, amount, currency, pin } = args;
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        // 1. Vérifier l'accès et le PIN
        const { rows: adminRows } = await connection.query('SELECT * FROM users WHERE id = $1', [adminId]);
        if (adminRows.length === 0) throw new Error("Super Agent introuvable.");
        const admin = adminRows[0];

        if (!(await bcrypt.compare(pin, admin.pin_hash))) {
            throw new Error("PIN Super Agent incorrect.");
        }

        // 2. Valider la juridiction
        await validateSuperAgentAccess(adminId, targetUserId, connection);

        // 3. Récupérer l'utilisateur cible
        const { rows: targetRows } = await connection.query('SELECT * FROM users WHERE id = $1', [targetUserId]);
        if (targetRows.length === 0) throw new Error("Client cible introuvable.");
        const target = targetRows[0];

        // 4. Exécuter la transaction SANS FRAIS (Souveraineté)
        const reference = generateReferenceCode('SOV_DEP');
        const txResult = await createTransaction({
            user: formatUser(admin),
            typeCode: 'DP_AGENT', 
            amount,
            currency,
            description: `Dépôt Souverain de l'Agence Nationale vers ${target.full_name}`,
            receiver_id: targetUserId,
            metadata: { sovereign: true, admin_id: adminId, reference },
            connection
        });

        if (!txResult.success) throw new Error(txResult.error || "Échec du transfert souverain.");

        // 5. Journaliser l'intervention
        await logIntervention(adminId, targetUserId, 'SOVEREIGN_DEPOSIT', `Dépôt direct de ${amount} ${currency} sans frais.`, connection);

        await connection.query('COMMIT');

        // 6. Notifications
        const msg = `CashPay: Votre compte a été crédité de ${amount} ${currency} par l'Agence Nationale. Réf: ${reference}.`;
        if (target.phone) sendSms(target.phone, msg).catch(console.error);

        return { success: true, reference };

    } catch (error: any) {
        if (connection) await connection.query('ROLLBACK');
        return { success: false, error: error.message || "Erreur lors du dépôt souverain." };
    } finally {
        if (connection) connection.release();
    }
}
