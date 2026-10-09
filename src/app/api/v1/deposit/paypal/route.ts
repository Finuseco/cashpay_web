import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { createTransaction } from "@/lib/actions/transaction.actions";
import { processMaxiCashPaypalPayment } from "@/services/maxicash";

export async function POST(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        const amount = Number(body.amount);
        const currency = String(
            body.currency || ""
        ).trim().toUpperCase();

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Montant invalide.",
                },
                { status: 400 }
            );
        }

        if (!currency) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Devise obligatoire.",
                },
                { status: 400 }
            );
        }

        /*
         * Une seule transaction CashPay pour tout le dépôt.
         * Elle reste Pending jusqu'à la confirmation MaxiCash.
         */
        const transaction = await createTransaction({
            user,
            typeCode: "DP",
            amount,
            currency,
            description: "Dépôt CashPay par PayPal",
            metadata: {
                source: "paypal",
                provider: "maxicash",
                paymentMethod: "paypal",
            },
            status: "Pending",
        });

        if (!transaction.success || !transaction.reference) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        transaction.error ||
                        "Impossible de créer la transaction.",
                },
                { status: 500 }
            );
        }

        const reference = transaction.reference;

        /*
         * Création de la session PayPal chez MaxiCash.
         */
        const maxiCash =
            await processMaxiCashPaypalPayment({
                amount,
                currency,
                reference,
                user,
            });

        if (
            !maxiCash.success ||
            !maxiCash.data?.paymentUrl
        ) {
            return NextResponse.json(
                {
                    success: false,
                    status: "Failed",
                    reference,
                    error:
                        maxiCash.message ||
                        "Impossible de créer le paiement PayPal.",
                },
                { status: 502 }
            );
        }

        /*
         * Aucun crédit ici.
         * Le webhook MaxiCash fera :
         *
         * Pending -> Completed
         * puis crédit du wallet.
         */
        return NextResponse.json({
            success: true,
            status: "Pending",
            reference,
            paymentUrl: maxiCash.data.paymentUrl,
        });
    } catch (error) {
        console.error(
            "[Deposit PayPal API] Error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: "Erreur interne.",
            },
            { status: 500 }
        );
    }
}
