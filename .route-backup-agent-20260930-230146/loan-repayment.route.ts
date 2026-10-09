import { NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/actions/auth.actions';
import {
  getAgentLoanRepaymentTarget,
  repayLoanByAgent,
} from '@/lib/actions/loan.actions';

const CURRENCIES = ['USD', 'EUR', 'CDF'] as const;

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.round((n + Number.EPSILON) * 100) / 100
    : 0;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return errorResponse('Authentification requise.', 401);
    }

    const role = String(user.role || '')
      .trim()
      .toLowerCase();

    if (role !== 'agent') {
      return errorResponse(
        'Vous n’êtes pas autorisé à utiliser ce service. Un compte Agent est requis.',
        403
      );
    }

    const body = await req.json();

    const clientRef = String(
      body?.clientWalletId ||
      body?.phone ||
      body?.clientId ||
      ''
    ).trim();

    const currency = String(
      body?.currency || ''
    ).trim().toUpperCase();

    const amount = money(body?.amount);
    const pin = String(body?.pin || '');

    if (!clientRef) {
      return errorResponse(
        'ID Wallet ou numéro de téléphone du client requis.'
      );
    }

    if (!CURRENCIES.includes(currency as any)) {
      return errorResponse('Devise invalide.');
    }

    if (amount <= 0) {
      return errorResponse('Montant invalide.');
    }

    /*
     * Même identification que l'USSD :
     *
     * getAgentLoanRepaymentTarget(
     *   identifiant client,
     *   devise
     * )
     */
    const target = await getAgentLoanRepaymentTarget(
      clientRef,
      currency
    );

    if (!target?.success) {
      return errorResponse(
        target?.error ||
          'Client ou prêt introuvable.'
      );
    }

    const debt = money(
      target.loan?.remaining_balance
    );

    if (amount > debt + 0.005) {
      return errorResponse(
        `Le montant dépasse la dette restante (${debt.toFixed(
          2
        )} ${currency}).`
      );
    }

    /*
     * PREVIEW
     *
     * Aucun débit ici.
     */
    if (!pin) {
      return NextResponse.json({
        success: true,
        preview: true,
        operation: 'agent_loan_repayment',

        amount,
        currency,

        debtBefore: debt,
        debtAfter: money(debt - amount),

        client: {
          userId: target.client?.id,
          walletId: target.client?.id_wallet,
          phone: target.client?.phone,
          firstName:
            target.client?.first_name ||
            target.client?.full_name ||
            'Client',
        },

        loan: {
          id: target.loan?.id,
          currency: target.loan?.currency,
          remainingBalance: debt,
        },

        /*
         * La commission est calculée par le moteur
         * existant repayLoanByAgent().
         */
        commission: null,
      });
    }

    /*
     * CONFIRMATION
     *
     * Même moteur que l'USSD.
     *
     * L'agent est débité.
     * Le remboursement est appliqué au prêt du client.
     * La commission agent est calculée par le backend.
     */
    const result = await repayLoanByAgent({
      agentId: user.id,
      clientId: Number(target.client.id),
      loanId: Number(target.loan.id),
      amount,
      currency,
      pin,
    });

    if (!result.success) {
      return errorResponse(
        result.error ||
          'Remboursement impossible.'
      );
    }

    return NextResponse.json({
      success: true,
      operation: 'agent_loan_repayment',

      reference: result.reference,

      paid: money(result.paid),
      currency: result.currency || currency,

      commission: money(result.commission),

      debtRemaining: money(
        result.remaining
      ),

      client: {
        userId: target.client?.id,
        walletId: target.client?.id_wallet,
        phone: target.client?.phone,
        firstName:
          target.client?.first_name ||
          target.client?.full_name ||
          'Client',
      },

      loan: {
        id: target.loan?.id,
      },
    });
  } catch (error: any) {
    console.error(
      '[AGENT_LOAN_REPAYMENT_API]',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Erreur interne du service de remboursement.',
      },
      { status: 500 }
    );
  }
}
