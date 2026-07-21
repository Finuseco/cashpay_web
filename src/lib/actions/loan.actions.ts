
'use server';

import type { User, Loan } from '@/lib/types';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { format, addMonths } from 'date-fns';
import { createTransaction } from './transaction.actions';
import { calculateTransactionFee } from './wallet.actions';
import { getAuthenticatedUser } from './user.actions';
import { countryToCode } from '../utils';
import type { PoolClient } from 'pg';


export interface LoanRepayment {
    id: number;
    amount: number;
    type: 'repayment' | 'penalty';
    payment_date: string;
}

export interface LoanHistory extends Loan {
    status: 'pending' | 'approved' | 'rejected' | 'repaid' | 'defaulted';
    repayments: LoanRepayment[];
    schedule?: { dueDate: string; amount: number; status: 'paid' | 'due' }[];
    monthly_payment?: number;
}

interface CreateLoanArgs {
    user: User;
    amount: number;
    currency: string;
    interestRate: number;
    durationMonths: number;
    purpose: string;
}

export async function createLoanApplication(args: CreateLoanArgs): Promise<{ success: boolean; error?: string }> {
    const { user, amount, currency, interestRate, durationMonths, purpose } = args;

    const totalRepayment = amount * (1 + (interestRate / 100) * durationMonths);

    const newLoan = {
        user_id: user.id,
        wallet_id: user.id_wallet,
        amount,
        currency,
        interest_rate: interestRate,
        duration: durationMonths,
        status: 'pending',
        monthly_payment: totalRepayment / durationMonths,
        remaining_balance: totalRepayment, // Initial remaining balance is the total to be repaid
        request_date: new Date(),
    };

    try {
        await db.query('INSERT INTO loans (user_id, wallet_id, amount, currency, interest_rate, duration, status, monthly_payment, remaining_balance, request_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', Object.values(newLoan));
        
        const smsMessage = `CashPay: Votre demande de prêt de ${amount} ${currency} a été soumise. Vous serez notifié des échéances après approbation.`;
        const emailSubject = `Confirmation de votre demande de prêt CashPay`;

        if (user.phone) {
            await sendSms(user.phone, smsMessage);
        }
        if (user.email) {
            await sendEmail(user.email, emailSubject, 'general', {
                title: 'Demande de Prêt Reçue',
                greeting: `Bonjour ${user.first_name},`,
                message: `Nous avons bien reçu votre demande de prêt de <strong>${amount} ${currency}</strong> pour une durée de ${durationMonths} mois. Notre équipe l'examine et vous recevrez une notification une fois qu'elle sera approuvée.`,
                buttonText: 'Voir mes prêts',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/loan/history`,
                signature: "L'équipe CashPay"
            });
        }

        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'creating loan application');
        return { success: false, error: dbError.error };
    }
}


export async function getLoanForUser(userId: number): Promise<Loan | null> {
    try {
        const { rows } = await db.query(`
            SELECT 
                id, 
                amount, 
                remaining_balance, 
                currency, 
                interest_rate,
                duration,
                monthly_payment,
                approval_date as start_date,
                (approval_date + (duration * interval '1 month')) as end_date
             FROM loans 
             WHERE user_id = $1 AND status = 'approved'
             ORDER BY request_date DESC
             LIMIT 1`, [userId]);

        if (rows.length === 0) {
            return null;
        }

        const loan = rows[0];
        // Correct calculation for the total amount to be repaid
        const totalAmount = parseFloat(loan.amount) * (1 + (parseFloat(loan.interest_rate) / 100 * loan.duration));
        const repaidAmount = totalAmount - parseFloat(loan.remaining_balance);
        
        return {
            id: loan.id,
            amount: totalAmount,
            repaid_amount: repaidAmount,
            currency: loan.currency,
            interest_rate: loan.interest_rate,
            start_date: format(new Date(loan.start_date), 'yyyy-MM-dd'),
            end_date: format(new Date(loan.end_date), 'yyyy-MM-dd'),
            remaining_balance: parseFloat(loan.remaining_balance),
            monthly_payment: parseFloat(loan.monthly_payment)
        };

    } catch (error) {
        await handleDbError(error, 'fetching user loan');
        return null;
    }
}


/**
 * Traitement AUTOMATIQUE des échéances de prêts (Appelé quotidiennement par Cron).
 */
export async function processLoanRepayments() {
  const connection = await db.getConnection();
  try {
    await connection.query('BEGIN');

    // 1. Trouver les prêts approuvés qui ont une échéance aujourd'hui et n'ont pas encore été payés ce mois-ci
    const { rows: loans } = await connection.query(`
        SELECT l.*, u.id as u_id, u.full_name, u.phone, u.email, u.first_name, u.country, u.id_wallet
        FROM loans l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN loan_repayments lr ON l.id = lr.loan_id 
            AND lr.payment_date >= (CURRENT_DATE - INTERVAL '1 month')
            AND lr.type = 'repayment'
        WHERE l.status = 'approved' 
          AND lr.id IS NULL
          AND EXTRACT(DAY FROM l.approval_date) = EXTRACT(DAY FROM CURRENT_DATE)
          AND l.remaining_balance > 0
    `);

    console.log(`[Auto Loan Recoup] Processing ${loans.length} due loans today.`);

    for (const loanData of loans) {
      const user = formatUser(loanData);
      const monthlyPayment = parseFloat(loanData.monthly_payment);
      const currency = loanData.currency;

      // 2. Tenter de débiter l'utilisateur via le moteur de transaction CashPay (Traçabilité totale)
      const transactionResult = await createTransaction({
        user,
        typeCode: 'LR', // LOAN_REPAYMENT
        amount: monthlyPayment,
        currency: currency,
        description: `Remboursement automatique prêt #${loanData.id} (Échéance mensuelle)`,
        metadata: { loan_id: loanData.id, method: 'automatic' },
        connection
      });

      if (transactionResult.success) {
        // 3. Mise à jour de la dette et log du remboursement
        await connection.query(
          'UPDATE loans SET remaining_balance = remaining_balance - $1 WHERE id = $2',
          [monthlyPayment, loanData.id]
        );
        await connection.query(
          'INSERT INTO loan_repayments (loan_id, amount, type) VALUES ($1, $2, $3)',
          [loanData.id, monthlyPayment, 'repayment']
        );
        
        console.log(`[Auto Loan Recoup] Repayment processed for loan ${loanData.id}. New remaining: ${transactionResult.senderNewBalance}`);
      } else {
        // 4. Si le solde est insuffisant, appliquer une pénalité (Souveraineté)
        const penaltyFee = await calculateTransactionFee(monthlyPayment, currency, 'PENALTY', user.country, connection);
        
        await connection.query(
          'UPDATE loans SET remaining_balance = remaining_balance + $1 WHERE id = $2',
          [penaltyFee, loanData.id]
        );
        await connection.query(
          'INSERT INTO loan_repayments (loan_id, amount, type) VALUES ($1, $2, $3)',
          [loanData.id, penaltyFee, 'penalty']
        );
        
        if (user.phone) {
            sendSms(user.phone, `CashPay Alerte: Échéance manquée pour le prêt #${loanData.id}. Une pénalité de ${penaltyFee.toFixed(2)} ${currency} a été ajoutée à votre dette.`).catch(console.error);
        }
        console.log(`[Auto Loan Recoup] Penalty applied to loan ${loanData.id} due to insufficient funds.`);
      }
    }
    
    // 5. Clôturer les prêts totalement remboursés
    await connection.query(`
        UPDATE loans SET status = 'repaid'
        WHERE status = 'approved' AND remaining_balance <= 0
    `);

    await connection.query('COMMIT');
    return { success: true };
  } catch (error) {
    await connection.query('ROLLBACK');
    console.error('[Auto Loan Recoup] Critical failure:', error);
    return { success: false, error: 'Failed to process automated repayments.' };
  } finally {
    connection.release();
  }
}

export async function approveLoanRequest(loanId: number, adminUserId: number): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: loanRows } = await connection.query(`
            SELECT l.*, u.*
            FROM loans l
            JOIN users u ON l.user_id = u.id
            WHERE l.id = $1 AND l.status = 'pending'
        `, [loanId]);

        if (loanRows.length === 0) {
            throw new Error('Demande de prêt non trouvée ou déjà traitée.');
        }

        const loan = loanRows[0];
        const user: User = loan as unknown as User;

        // Correct calculation
        const totalRepayment = parseFloat(loan.amount) * (1 + (parseFloat(loan.interest_rate) / 100 * loan.duration));

        await connection.query(
            "UPDATE loans SET status = 'approved', approval_date = NOW(), remaining_balance = $1 WHERE id = $2",
            [totalRepayment, loanId]
        );
        
        const transactionResult = await createTransaction({
            user: user,
            typeCode: 'LP', // Loan Payout
            amount: parseFloat(loan.amount),
            currency: loan.currency,
            description: `Décaissement du prêt #${loanId}`,
            metadata: { loan_id: loanId, approved_by: adminUserId },
            connection
        });

        if (!transactionResult.success || !transactionResult.transactionId) {
            throw new Error(transactionResult.error || "Échec du décaissement des fonds du prêt.");
        }

        await connection.query('COMMIT');

        const smsMessage = `CashPay: Bonne nouvelle ! Votre prêt de ${loan.amount} ${loan.currency} a été approuvé et les fonds ont été ajoutés à votre portefeuille.`;
        if (user.phone) {
            await sendSms(user.phone, smsMessage);
        }
        if (user.email) {
            await sendEmail(user.email, "Votre Prêt a été Approuvé", 'general', {
                title: "Prêt Approuvé !",
                greeting: `Félicitations ${user.first_name},`,
                message: `Votre demande de prêt de <strong>${loan.amount} ${loan.currency}</strong> a été approuvée. Les fonds ont été crédités sur votre portefeuille principal.`,
                buttonText: 'Voir mes prêts',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/loan/history`,
                signature: "L'équipe CashPay"
            });
        }


        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'approving loan');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

export async function getLoanHistory(userId: number): Promise<LoanHistory[]> {
  try {
    const { rows: loans } = await db.query('SELECT * FROM loans WHERE user_id = $1 ORDER BY request_date DESC', [userId]);
    
    const history: LoanHistory[] = [];

    for (const loan of loans) {
      const { rows: repayments } = await db.query('SELECT * FROM loan_repayments WHERE loan_id = $1 ORDER BY payment_date ASC', [loan.id]);
      
      const totalAmount = parseFloat(loan.amount) * (1 + (parseFloat(loan.interest_rate) / 100 * loan.duration));
      const repaidAmount = repayments.filter(r => r.type === 'repayment').reduce((sum, r) => sum + parseFloat(r.amount), 0);

      const schedule: { dueDate: string; amount: number; status: 'paid' | 'due' }[] = [];
      if (loan.status === 'approved' && loan.approval_date) {
        const monthlyPayment = parseFloat(loan.monthly_payment);
        for (let i = 1; i <= loan.duration; i++) {
          const dueDate = addMonths(new Date(loan.approval_date), i);
          const repaymentForMonth = repayments.find(r => 
            r.type === 'repayment' &&
            new Date(r.payment_date).getMonth() === dueDate.getMonth() &&
            new Date(r.payment_date).getFullYear() === dueDate.getFullYear()
          );
          schedule.push({
            dueDate: format(dueDate, 'yyyy-MM-dd'),
            amount: monthlyPayment,
            status: repaymentForMonth ? 'paid' : 'due',
          });
        }
      }
      
      history.push({
        id: loan.id,
        amount: totalAmount,
        repaid_amount: repaidAmount,
        currency: loan.currency,
        interest_rate: loan.interest_rate,
        monthly_payment: parseFloat(loan.monthly_payment),
        start_date: format(new Date(loan.approval_date || loan.request_date), 'yyyy-MM-dd'),
        end_date: format(new Date(loan.approval_date || loan.request_date).setMonth(new Date(loan.approval_date || loan.request_date).getMonth() + loan.duration), 'yyyy-MM-dd'),
        remaining_balance: parseFloat(loan.remaining_balance),
        status: loan.status,
        repayments: repayments.map(r => ({
          id: r.id,
          amount: parseFloat(r.amount),
          type: r.type,
          payment_date: new Date(r.payment_date).toISOString(),
        })),
        schedule,
      });
    }

    return history;
  } catch (error) {
    await handleDbError(error, 'fetching loan history');
    return [];
  }
}

/**
 * Sends reminders to users whose loan repayments are due soon.
 * Intended to be run by a daily cron job.
 */
export async function sendLoanRepaymentReminders(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
        const { rows: loansToRemind } = await db.query(`
            SELECT l.id, l.monthly_payment, l.currency, u.phone, u.full_name, u.email, u.first_name
            FROM loans l
            JOIN users u ON l.user_id = u.id
            WHERE l.status = 'approved'
              AND (DATE(l.approval_date) + (
                  SELECT COUNT(*) FROM loan_repayments lr WHERE lr.loan_id = l.id AND lr.type = 'repayment'
              ) * INTERVAL '1 month' + INTERVAL '27 days') = CURRENT_DATE
        `);

        for (const loan of loansToRemind) {
            const message = `CashPay Rappel: Votre remboursement de prêt de ${parseFloat(loan.monthly_payment).toFixed(2)} ${loan.currency} est dû dans 3 jours. Assurez-vous d'avoir un solde suffisant.`;
            if (loan.phone) {
                await sendSms(loan.phone, message);
            }
             if (loan.email) {
                await sendEmail(loan.email, "Rappel de Remboursement de Prêt", 'general', {
                    title: "Rappel de Paiement",
                    greeting: `Bonjour ${loan.first_name},`,
                    message: `Ceci est un rappel que votre échéance de prêt de <strong>${parseFloat(loan.monthly_payment).toFixed(2)} ${loan.currency}</strong> est due dans 3 jours.`,
                    buttonText: 'Voir mes prêts',
                    buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/loan/history`,
                    signature: "L'équipe CashPay"
                });
            }
        }
        
        return { success: true, message: `Sent ${loansToRemind.length} loan repayment reminders.` };
    } catch (error) {
        const dbError = await handleDbError(error, 'sending loan reminders');
        return { success: false, message: 'Failed to send reminders.', error: dbError.error || 'An unknown error occurred' };
    }
}
