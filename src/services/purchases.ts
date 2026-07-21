
'use server';

import { getTransactionControls } from '@/lib/actions/transaction-controls.actions';
import type { TransactionControl } from '@/lib/actions/transaction-controls.actions';
import { db } from '@/lib/db';
import { handleDbError } from '@/lib/actions/helpers';
import type mysql from 'mysql2/promise';

interface PurchaseAuthorizationRequest {
  cardNumber: string;
  amount: number;
  currency: string;
  merchantCategoryCode: string;
  transactionType: 'ECOMMERCE' | 'POS' | 'ATM' | 'RECURRING';
}

interface AuthorizationResponse {
  approved: boolean;
  reason: string;
}

/**
 * Simulates the internal process of authorizing or declining a card purchase.
 * This function is called by the Visa/Mastercard webhook simulation.
 * @param request - The details of the purchase attempt.
 * @returns A promise that resolves with the authorization decision.
 */
export async function authorizePurchase(request: PurchaseAuthorizationRequest): Promise<AuthorizationResponse> {
  console.log('[Purchase Service] Authorizing purchase:', request);
  
  try {
    // 1. Get the card and user details from our database using the card number.
    const [cardRows] = await db.query<mysql.RowDataPacket[]>(`
        SELECT c.*, w.balances
        FROM cards c
        JOIN wallets w ON c.user_id = w.user_id
        WHERE c.number = ?
    `, [request.cardNumber]);

    if (cardRows.length === 0) {
        return { approved: false, reason: 'Card not found.' };
    }
    const cardData = cardRows[0];
    const userWalletBalances = JSON.parse(cardData.balances || '{}');

    // 2. Fetch the user-defined controls for this card.
    const controls = await getTransactionControls(cardData.id.toString());

    // 3. Evaluate the transaction against the controls.
    for (const control of controls) {
      if (control.control_type === request.transactionType && control.is_blocked) {
        const reason = `Declined: Transaction type '${request.transactionType}' is blocked by the user.`;
        console.log(`[Purchase Service] ${reason}`);
        return { approved: false, reason };
      }
      if (control.control_type === 'MERCHANT_CATEGORY' && control.is_blocked && control.mcc === request.merchantCategoryCode) {
          const reason = `Declined: Merchant category '${request.merchantCategoryCode}' is blocked by the user.`;
          console.log(`[Purchase Service] ${reason}`);
          return { approved: false, reason };
      }
      if (control.control_type === 'VELOCITY_LIMIT' && control.window === 'TRANSACTION' && control.limit_value !== null && request.amount > control.limit_value) {
         const reason = `Declined: Amount ${request.amount} exceeds per-transaction limit of ${control.limit_value}.`;
         console.log(`[Purchase Service] ${reason}`);
         return { approved: false, reason };
      }
       if (control.control_type === 'VELOCITY_LIMIT' && control.window !== 'TRANSACTION' && control.limit_value !== null) {
          // This is a velocity check (DAY, WEEK, MONTH)
          const windowHours = { 'DAY': 24, 'WEEK': 24 * 7, 'MONTH': 24 * 30 }[control.window!];
          if (windowHours) {
              const [pastTxRows] = await db.query<mysql.RowDataPacket[]>(`
                  SELECT SUM(amount) as totalSpent 
                  FROM card_transactions 
                  WHERE card_id = ? AND created_at >= NOW() - INTERVAL ? HOUR
              `, [cardData.id, windowHours]);
              
              const totalSpentInWindow = parseFloat(pastTxRows[0]?.totalSpent || '0');
              const newTotal = totalSpentInWindow + request.amount;
              
              if (newTotal > control.limit_value) {
                  const reason = `Declined: New total of ${newTotal} exceeds ${control.window} limit of ${control.limit_value}.`;
                  console.log(`[Purchase Service] ${reason}`);
                  return { approved: false, reason };
              }
          }
      }
    }

    // 4. Check the user's actual balance for the card's currency.
    const cardCurrency = cardData.currency;
    const userBalanceForCurrency = userWalletBalances[cardCurrency] || 0;

    if (userBalanceForCurrency < request.amount) {
        const reason = `Declined: Insufficient funds. Available: ${userBalanceForCurrency}, Required: ${request.amount}`;
        console.log(`[Purchase Service] ${reason}`);
        return { approved: false, reason };
    }

    // 5. If everything is okay, approve the transaction.
    console.log('[Purchase Service] Approved: All checks passed.');
    return { approved: true, reason: 'Approved' };

  } catch (error) {
    const dbError = await handleDbError(error, 'authorizing purchase');
    return { approved: false, reason: `Internal Server Error: ${dbError.error}` };
  }
}
