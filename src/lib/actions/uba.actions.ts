
'use server';

import type { User } from '@/lib/types';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';
import { sendToUbaAccount } from '@/services/uba';

interface UbaPayoutArgs {
    user: User;
    pin: string;
    amount: number;
    currency: 'USD' | 'EUR' | 'CDF';
    accountNumber: string;
    recipientName: string;
    destinationBankCode: string;
}

export async function processUbaPayout(args: UbaPayoutArgs): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    const { user, pin, ...payoutData } = args;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }
    
    const transactionResult = await createTransaction({
        user,
        typeCode: 'WD_VIREMENT_BANKS_FEES',
        amount: payoutData.amount,
        currency: payoutData.currency,
        description: `Virement vers le compte UBA ${payoutData.accountNumber}`,
        metadata: { provider: 'UBA', ...payoutData }
    });
    
    if (!transactionResult.success || !transactionResult.reference) {
        return { success: false, error: transactionResult.error };
    }
    
    const ubaResult = await sendToUbaAccount({ ...payoutData, reference: transactionResult.reference });
    
    if (ubaResult.success && ubaResult.data?.paymentReference) {
         return { success: true, transactionId: ubaResult.data.paymentReference };
    } else {
         // TODO: Reversal logic
         return { success: false, error: ubaResult.error || "Le virement vers le compte UBA a échoué." };
    }
}
