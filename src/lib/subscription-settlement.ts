import {db} from '@/lib/db';
import {createTransaction} from '@/lib/actions/transaction.actions';
import type {User} from '@/lib/types';
/** Internal settlement; caller must first verify identity, PIN and the database tariff. Not a Server Action. */
export async function createVerifiedSubscription(args: {
    user: User;
    serviceName: string;
    amount: number;
    operatorName: string;
    smartcardNumber: string;
    currency?: string;
    status?: 'active' | 'pending';
    metadata?: Record<string, any>;
    requestKey?: string;
}): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        if(!Number.isFinite(args.amount)||args.amount<=0||!args.serviceName?.trim()||!args.operatorName?.trim()||!args.smartcardNumber?.trim())throw new Error('Montant et informations d’abonnement requis.');
        if(args.status && args.status!=='pending')throw new Error('L’activation nécessite une confirmation fournisseur.');
        await connection.query('BEGIN');
        if(args.requestKey){
            await connection.query('SELECT pg_advisory_xact_lock(11809,$1::int)',[args.user.id]);
            const existing=await connection.query('SELECT id FROM subscriptions WHERE user_id=$1 AND request_key=$2',[args.user.id,args.requestKey]);
            if(existing.rows.length){await connection.query('COMMIT');return {success:true};}
        }

        // Débiter le compte souverain
        const tx = await createTransaction({
            user: args.user,
            typeCode: 'TV',
            amount: args.amount,
            currency: args.currency || 'USD',
            description: `Abonnement ${args.operatorName} - ${args.serviceName}`,
            metadata: {
                smartcardNumber: args.smartcardNumber,
                operator: args.operatorName,
                ...(args.metadata || {})
            },
            connection
        });

        if (!tx.success) throw new Error(tx.error || "Paiement échoué");

        // Enregistrer l'abonnement
        await connection.query(
            `INSERT INTO subscriptions (user_id, service_name, amount, operator_name, smartcard_number, status, transaction_id, request_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                args.user.id,
                args.serviceName,
                args.amount,
                args.operatorName,
                args.smartcardNumber,
                'pending',
                tx.transactionId,
                args.requestKey || null
            ]
        );

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        if (connection) await connection.query('ROLLBACK');
        return { success: false, error: error.code==='42P01' ? 'Service indisponible : le schéma des abonnements doit être installé. Aucun débit confirmé.' : error.message };
    } finally {
        if (connection) connection.release();
    }
}
