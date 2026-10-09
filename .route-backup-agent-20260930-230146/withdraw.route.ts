import { NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/actions/auth.actions';
import {
  getUssdRecipientInfo,
  executeClientAgentWithdrawal,
} from '@/lib/ussd/ussd.actions';
import { getUssdFee } from '@/lib/ussd/ussd.actions';
import { getUssdBalance } from '@/lib/ussd/ussd.actions';
import { confirmWithdrawal } from '@/lib/actions/agent.actions';

const CURRENCIES = ['USD', 'EUR', 'CDF'] as const;

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
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

    const operation = String(body?.operation || '').trim();
    const currency = String(body?.currency || '').trim().toUpperCase();
    const amount = money(body?.amount);

    if (!['client_withdraw', 'agent_withdraw'].includes(operation)) {
      return errorResponse(
        'Opération invalide. Utilisez client_withdraw ou agent_withdraw.'
      );
    }

    if (!CURRENCIES.includes(currency as any)) {
      return errorResponse('Devise invalide.');
    }

    if (amount <= 0) {
      return errorResponse('Montant invalide.');
    }

    /*
     * ============================================================
     * CLIENT -> RETRAIT CHEZ UN AGENT
     * ============================================================
     */

    if (operation === 'client_withdraw') {
      const agentWalletId = String(body?.agentWalletId || '').trim();
      const pin = String(body?.pin || '');

      if (!agentWalletId) {
        return errorResponse('Agent requis.');
      }

      /*
       * On reprend exactement l'identification USSD.
       */
      const agentInfo = await getUssdRecipientInfo(agentWalletId);

      if (!agentInfo.success) {
        return errorResponse(
          agentInfo.error || 'Agent introuvable.'
        );
      }

      if (String(agentInfo.role || '').toLowerCase() !== 'agent') {
        return errorResponse(
          'Ce portefeuille n’est pas un portefeuille agent CashPay.'
        );
      }

      /*
       * Même contrôle que executeClientAgentWithdrawal().
       */
      const previewFee = money(
        await getUssdFee(
          amount,
          currency,
          'WD',
          String((user as any).country || '')
        )
      );

      const totalDebit = money(amount + previewFee);

      /*
       * PREVIEW uniquement.
       */
      if (!pin) {
        const balance = money(
          await getUssdBalance(user.id, currency)
        );

        if (balance < totalDebit) {
          return NextResponse.json(
            {
              success: false,
              preview: true,
              error: 'Solde insuffisant.',
              amount,
              fee: previewFee,
              totalDebit,
              balance,
              currency,
              agent: {
                userId: agentInfo.userId,
                walletId: agentInfo.walletId,
                firstName: agentInfo.firstName,
                phone: agentInfo.phone,
              },
            },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          preview: true,
          amount,
          fee: previewFee,
          totalDebit,
          balance,
          currency,
          agent: {
            userId: agentInfo.userId,
            walletId: agentInfo.walletId,
            firstName: agentInfo.firstName,
            phone: agentInfo.phone,
          },
        });
      }

      /*
       * CONFIRMATION :
       * on ne recrée pas le moteur financier.
       * On utilise exactement l'action USSD existante.
       */
      const result = await executeClientAgentWithdrawal(
        user,
        agentWalletId,
        amount,
        currency,
        pin
      );

      if (!result.success) {
        return errorResponse(
          result.error || 'Retrait impossible.'
        );
      }

      return NextResponse.json({
        success: true,
        operation: 'client_withdraw',
        reference: result.reference,
        amount,
        fee: money((result as any).fee ?? previewFee),
        totalDebit: money(
          (result as any).totalDebit ?? amount + previewFee
        ),
        currency,
        agent: result.agent || agentInfo,
      });
    }

    /*
     * ============================================================
     * AGENT -> DEMANDE DE RETRAIT CLIENT
     * ============================================================
     */

    if (operation === 'agent_withdraw') {
      const clientWalletId = String(
        body?.clientWalletId || ''
      ).trim();

      const code = String(body?.otp || '').trim();

      if (!clientWalletId) {
        return errorResponse('Client requis.');
      }

      /*
       * Identification du client exactement comme USSD.
       */
      const clientInfo = await getUssdRecipientInfo(clientWalletId);

      if (!clientInfo.success) {
        return errorResponse(
          clientInfo.error || 'Client introuvable.'
        );
      }

      /*
       * PREVIEW
       *
       * Aucun débit ici.
       */
      if (!code) {
        const fee = money(
          await getUssdFee(
            amount,
            currency,
            'WD',
            String((user as any).country || '')
          )
        );

        const totalDebit = money(amount + fee);

        const balance = money(
          await getUssdBalance(
            Number(clientInfo.userId),
            currency
          )
        );

        return NextResponse.json({
          success: true,
          preview: true,
          operation: 'agent_withdraw',
          amount,
          fee,
          totalDebit,
          balance,
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
       * CONFIRMATION OTP
       *
       * Même moteur que :
       *
       * agentWithdrawOtp()
       *
       * confirmWithdrawal({
       *   method: 'otp'
       * })
       */
      const result = await confirmWithdrawal({
        agent: user as any,
        clientWalletId,
        amount,
        currency: currency as 'USD' | 'EUR' | 'CDF',
        code,
        method: 'otp',
      });

      if (!result.success) {
        return errorResponse(
          result.error || 'Autorisation du retrait impossible.'
        );
      }

      return NextResponse.json({
        success: true,
        operation: 'agent_withdraw',
        reference: result.reference,
        amount,
        fee: money((result as any).fee),
        totalDebit: money(
          (result as any).totalDebit ??
          amount + money((result as any).fee)
        ),
        currency,
        commission: money((result as any).commission),
      });
    }

    return errorResponse('Opération non supportée.');
  } catch (error: any) {
    console.error(
      '[AGENT_WITHDRAW_API]',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Erreur interne du service de retrait.',
      },
      { status: 500 }
    );
  }
}
