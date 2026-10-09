import { NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/actions/auth.actions';
import {
  getUssdRecipientInfo,
  getUssdBalance,
  executeAgentDeposit,
} from '@/lib/ussd/ussd.actions';

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

    const clientWalletId = String(
      body?.clientWalletId || ''
    ).trim();

    const currency = String(
      body?.currency || ''
    ).trim().toUpperCase();

    const amount = money(body?.amount);
    const pin = String(body?.pin || '');

    if (!clientWalletId) {
      return errorResponse('Client requis.');
    }

    if (!CURRENCIES.includes(currency as any)) {
      return errorResponse('Devise invalide.');
    }

    if (amount <= 0) {
      return errorResponse('Montant invalide.');
    }

    /*
     * Identification du client :
     * même logique que l'USSD.
     */
    const clientInfo = await getUssdRecipientInfo(
      clientWalletId
    );

    if (!clientInfo.success) {
      return errorResponse(
        clientInfo.error || 'Client introuvable.'
      );
    }

    /*
     * Un dépôt agent est destiné à un client.
     */
    if (
      String(clientInfo.role || '')
        .trim()
        .toLowerCase() === 'agent'
    ) {
      return errorResponse(
        'Le portefeuille indiqué appartient à un agent.'
      );
    }

    /*
     * PREVIEW
     *
     * Le dépôt agent est sans frais.
     */
    if (!pin) {
      const agentBalance = money(
        await getUssdBalance(user.id, currency)
      );

      if (agentBalance < amount) {
        return NextResponse.json(
          {
            success: false,
            preview: true,
            error: 'Solde agent insuffisant.',
            amount,
            fee: 0,
            totalDebit: amount,
            balance: agentBalance,
            currency,
            client: {
              userId: clientInfo.userId,
              walletId: clientInfo.walletId,
              firstName: clientInfo.firstName,
              phone: clientInfo.phone,
            },
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        preview: true,
        operation: 'agent_deposit',
        amount,
        fee: 0,
        totalDebit: amount,
        balance: agentBalance,
        currency,
        client: {
          userId: clientInfo.userId,
          walletId: clientInfo.walletId,
          firstName: clientInfo.firstName,
          phone: clientInfo.phone,
        },
      });
    }

    /*
     * CONFIRMATION
     *
     * On utilise directement l'action USSD existante.
     * Aucun createTransaction() ici.
     */
    const result = await executeAgentDeposit(
      user as any,
      clientWalletId,
      amount,
      currency,
      pin
    );

    if (!result.success) {
      return errorResponse(
        result.error || 'Dépôt impossible.'
      );
    }

    return NextResponse.json({
      success: true,
      operation: 'agent_deposit',
      reference: result.reference,
      amount,
      fee: 0,
      totalDebit: amount,
      currency,
      client: result.client || clientInfo,
    });
  } catch (error: any) {
    console.error(
      '[AGENT_DEPOSIT_API]',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Erreur interne du service de dépôt.',
      },
      { status: 500 }
    );
  }
}
