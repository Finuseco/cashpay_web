import { db } from '@/lib/db';
import { formatUser } from '@/lib/utils';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import * as bcrypt from 'bcryptjs';

export interface UssdTransferSession {
    sessionId: string;
    userId: number;
    activeCurrency: string;
    phoneNumber: string;
    data: Record<string, any>;
}

export async function handleUssdTransfer(
    session: UssdTransferSession,
    input: string
): Promise<{
    response: string;
    menuState: string;
    data?: Record<string, any>;
}> {
    const { userId, activeCurrency, data } = session;

    if (data.transferState === 'TR_CP_RECIPIENT') {
        const recipient = String(input || '').trim();

        if (!recipient) {
            return {
                response:
                    "CON Transfert CashPay\n" +
                    "Numéro de tél. ou ID Wallet :",
                menuState: 'TRANSFER',
                data: {
                    ...data,
                    transferState: 'TR_CP_RECIPIENT'
                }
            };
        }

        const { rows } = await db.query(
            `
            SELECT
                id,
                id_wallet,
                full_name
            FROM users
            WHERE phone = $1
               OR id_wallet = $1
            LIMIT 1
            `,
            [recipient]
        );

        if (rows.length === 0) {
            return {
                response:
                    "CON Utilisateur non trouvé sur le réseau CashPay.\n" +
                    "1. Réessayer\n" +
                    "0. Retour",
                menuState: 'TRANSFER',
                data: {
                    ...data,
                    transferState: 'TR_CP_RECIPIENT'
                }
            };
        }

        const target = rows[0];

        if (Number(target.id) === Number(userId)) {
            return {
                response:
                    "CON Vous ne pouvez pas effectuer un transfert " +
                    "vers votre propre compte.\n\n" +
                    "Numéro de tél. ou ID Wallet :",
                menuState: 'TRANSFER',
                data: {
                    ...data,
                    transferState: 'TR_CP_RECIPIENT'
                }
            };
        }

        return {
            response:
                `CON Destinataire : ${target.full_name}\n` +
                `Wallet : ${target.id_wallet}\n\n` +
                `Montant à envoyer (${activeCurrency}) :`,
            menuState: 'TRANSFER',
            data: {
                ...data,
                transferState: 'TR_CP_AMOUNT',
                targetId: target.id,
                targetName: target.full_name,
                targetWallet: target.id_wallet
            }
        };
    }

    if (data.transferState === 'TR_CP_AMOUNT') {
        const amount = Number(String(input || '').trim());

        if (!Number.isFinite(amount) || amount <= 0) {
            return {
                response:
                    "CON Montant invalide.\n" +
                    `Montant à envoyer (${activeCurrency}) :`,
                menuState: 'TRANSFER',
                data
            };
        }

        const user = await getUserById(userId);

        if (!user) {
            return {
                response:
                    "END Profil utilisateur introuvable.",
                menuState: 'MAIN_MENU',
                data
            };
        }

        const fee = await calculateTransactionFee(
            amount,
            activeCurrency,
            'TR',
            user.country
        );

        return {
            response:
                "CON Confirmation\n" +
                `Envoyer : ${amount} ${activeCurrency}\n` +
                `Frais : ${Number(fee).toFixed(2)}\n` +
                `Total : ${(amount + Number(fee)).toFixed(2)}\n\n` +
                "Entrez votre PIN :",
            menuState: 'TRANSFER',
            data: {
                ...data,
                transferState: 'TR_CP_CONFIRM_PIN',
                amount,
                fee: Number(fee)
            }
        };
    }

    if (data.transferState === 'TR_CP_CONFIRM_PIN') {
        const user = await getUserById(userId);

        if (!user) {
            return {
                response:
                    "END Profil utilisateur introuvable.",
                menuState: 'MAIN_MENU',
                data
            };
        }

        if (!user.pin_hash) {
            return {
                response:
                    "END Aucun PIN n'est configuré pour ce compte.",
                menuState: 'MAIN_MENU',
                data
            };
        }

        const isMatch = await bcrypt.compare(
            String(input || ''),
            user.pin_hash
        );

        if (!isMatch) {
            return {
                response:
                    "END Code PIN incorrect.",
                menuState: 'MAIN_MENU',
                data
            };
        }

        const result = await createTransaction({
            user,
            typeCode: 'TR',
            amount: Number(data.amount),
            currency: activeCurrency,
            description:
                `Transfert USSD vers ${data.targetName}`,
            receiver_id: data.targetId,
            receiver_wallet_id: data.targetWallet
        });

        if (!result.success) {
            return {
                response:
                    `END Échec du transfert : ${result.error || 'Une erreur est survenue.'}`,
                menuState: 'MAIN_MENU',
                data
            };
        }

        return {
            response:
                `END Transfert réussi ! ` +
                `${data.amount} ${activeCurrency} ` +
                `envoyés à ${data.targetName}. ` +
                `Réf: ${result.reference}`,
            menuState: 'MAIN_MENU',
            data: {
                userId,
                activeCurrency
            }
        };
    }

    return {
        response:
            "CON Transfert CashPay\n" +
            "Numéro de tél. ou ID Wallet :",
        menuState: 'TRANSFER',
        data: {
            ...data,
            transferState: 'TR_CP_RECIPIENT'
        }
    };
}

async function getUserById(id: number) {
    const { rows } = await db.query(
        `
        SELECT *
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [id]
    );

    return rows[0]
        ? formatUser(rows[0])
        : null;
}
