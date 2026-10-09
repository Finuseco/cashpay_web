import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { createTransaction } from "@/lib/actions/transaction.actions";
import { processMaxiCashCardPayment } from "@/services/maxicash";

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
        const currency = String(body.currency || "").trim().toUpperCase();

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
         * 1. Création de la transaction CashPay.
         *
         * Elle reste Pending.
         * createTransaction ne crédite donc pas le wallet.
         */
        const transaction = await createTransaction({
            user,
            typeCode: "DP",
            amount,
            currency,
            description: "Dépôt CashPay par carte",
            metadata: {
                source: "card",
                provider: "maxicash",
                paymentMethod: "card",
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
         * 2. Création de la session de paiement MaxiCash.
         */
        const maxiCash = await processMaxiCashCardPayment({
            amount,
            currency,
            reference,
            user,
        });

        if (!maxiCash.success || !maxiCash.data?.paymentUrl) {
            return NextResponse.json(
                {
                    success: false,
                    status: "Failed",
                    reference,
                    error:
                        maxiCash.message ||
                        "Impossible de créer le paiement MaxiCash.",
                },
                { status: 502 }
            );
        }

        /*
         * 3. La transaction reste Pending.
         *
         * Le wallet sera crédité uniquement par :
         * /api/webhooks/maxicash
         */
        return NextResponse.json({
            success: true,
            status: "Pending",
            reference,
            paymentUrl: maxiCash.data.paymentUrl,
        });
    } catch (error) {
        console.error("[Deposit Card API] Error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Erreur interne.",
            },
            { status: 500 }
        );
    }
}
