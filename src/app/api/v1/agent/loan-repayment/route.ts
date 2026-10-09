import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

import { getAuthenticatedUser } from '@/lib/actions/user.actions';

import {
  getAgentLoanRepaymentTarget,
  repayLoanByAgent,
} from '@/lib/actions/loan.actions';

const CURRENCIES = ['USD', 'EUR', 'CDF'] as const;

type Currency = (typeof CURRENCIES)[number];

type LoanOperation = {
  v: 1;
  operationId: string;
  operation: 'agent_loan_repayment';

  step:
    | 'confirm_identity'
    | 'amount'
    | 'confirm_amount'
    | 'pin'
    | 'completed';

  agentId: number;

  clientRef: string;

  clientUserId: number;
  clientWalletId: string;

  loanId: number;
  loanCurrency: string;

  debtBefore?: number;
  amount?: number;
  debtAfter?: number;

  currency?: Currency;

  createdAt: number;
};

function getSecret() {
  const secret =
    process.env.AGENT_OPERATION_SECRET;

  if (!secret) {
    throw new Error(
      'AGENT_OPERATION_SECRET n’est pas configuré.'
    );
  }

  return secret;
}

function money(value: unknown) {
  const n = Number(value);

  return Number.isFinite(n)
    ? Math.round((n + Number.EPSILON) * 100) / 100
    : 0;
}

function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

function createOperationId() {
  return `op_${crypto.randomBytes(18).toString('hex')}`;
}

function signPayload(
  payload: LoanOperation
) {
  const encoded = Buffer.from(
    JSON.stringify(payload)
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');

  return `${encoded}.${signature}`;
}

function readOperation(
  token: string
): LoanOperation | null {
  try {
    const parts =
      String(token || '').split('.');

    if (parts.length !== 2) {
      return null;
    }

    const [encoded, signature] =
      parts;

    const expected = crypto
      .createHmac('sha256', getSecret())
      .update(encoded)
      .digest('base64url');

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          'base64url'
        ).toString('utf8')
      ) as LoanOperation;

    if (
      !payload ||
      payload.v !== 1 ||
      payload.operation !==
        'agent_loan_repayment'
    ) {
      return null;
    }

    if (
      !payload.createdAt ||
      Date.now() -
        payload.createdAt >
        15 * 60 * 1000
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function nextToken(
  operation: LoanOperation,
  changes: Partial<LoanOperation>
) {
  return signPayload({
    ...operation,
    ...changes,
  });
}

function clientIdentity(
  target: any
) {
  return {
    userId:
      target?.client?.id ||
      null,

    walletId:
      target?.client?.id_wallet ||
      null,

    phone:
      target?.client?.phone ||
      null,

    firstName:
      target?.client?.first_name ||
      target?.client?.full_name ||
      'Client',

    fullName:
      target?.client?.full_name ||
      target?.client?.first_name ||
      'Client',

    avatar:
      target?.client?.profile_photo ||
      null,
  };
}

export async function POST(
  req: NextRequest
) {
  try {
    const user =
      await getAuthenticatedUser();

    if (!user) {
      return errorResponse(
        'Authentification requise.',
        401
      );
    }

    const role = String(
      user.role || ''
    )
      .trim()
      .toLowerCase();

    if (role !== 'agent') {
      return errorResponse(
        'Un compte Agent est requis.',
        403
      );
    }

    const body =
      await req.json();

    const action =
      String(
        body?.action || 'start'
      )
        .trim()
        .toLowerCase();

    /*
     * ============================================================
     * START
     *
     * Android identifie le client.
     * Aucun montant.
     * Aucun PIN.
     * ============================================================
     */
    if (action === 'start') {
      const clientRef =
        String(
          body?.clientWalletId ||
          body?.phone ||
          body?.clientRef ||
          ''
        ).trim();

      if (!clientRef) {
        return errorResponse(
          'Wallet ID ou numéro de téléphone du client requis.'
        );
      }

      const target =
        await getAgentLoanRepaymentTarget(
          clientRef,
          String(
            body?.currency || ''
          )
            .trim()
            .toUpperCase()
        );

      if (!target?.success) {
        return errorResponse(
          target?.error ||
            'Client ou prêt introuvable.'
        );
      }

      if (
        !target.client?.id ||
        !target.client?.id_wallet ||
        !target.loan?.id
      ) {
        return errorResponse(
          'Informations du client ou du prêt incomplètes.'
        );
      }

      const debt =
        money(
          target.loan
            ?.remaining_balance
        );

      if (debt <= 0) {
        return errorResponse(
          'Ce prêt ne présente aucun solde restant.'
        );
      }

      const operation: LoanOperation = {
        v: 1,

        operationId:
          createOperationId(),

        operation:
          'agent_loan_repayment',

        step:
          'confirm_identity',

        agentId:
          Number(user.id),

        clientRef,

        clientUserId:
          Number(
            target.client.id
          ),

        clientWalletId:
          String(
            target.client.id_wallet
          ),

        loanId:
          Number(
            target.loan.id
          ),

        loanCurrency:
          String(
            target.loan.currency ||
              body?.currency ||
              ''
          ).toUpperCase(),

        debtBefore:
          debt,

        createdAt:
          Date.now(),
      };

      return NextResponse.json({
        success: true,

        operationId:
          signPayload(operation),

        operation:
          'agent_loan_repayment',

        step:
          'confirm_identity',

        nextStep:
          'confirm_identity',

        client:
          clientIdentity(target),

        loan: {
          id:
            target.loan.id,

          currency:
            target.loan.currency,

          remainingBalance:
            debt,
        },
      });
    }

    /*
     * Toutes les étapes après START nécessitent
     * l'opération signée.
     */
    const operationToken =
      String(
        body?.operationId || ''
      ).trim();

    if (!operationToken) {
      return errorResponse(
        'operationId requis.'
      );
    }

    const operation =
      readOperation(
        operationToken
      );

    if (!operation) {
      return errorResponse(
        'Opération invalide, expirée ou altérée.',
        409
      );
    }

    if (
      Number(
        operation.agentId
      ) !== Number(user.id)
    ) {
      return errorResponse(
        'Cette opération appartient à un autre Agent.',
        403
      );
    }

    /*
     * ============================================================
     * CONFIRM IDENTITY
     *
     * On recharge le prêt.
     * On ne fait pas confiance au snapshot précédent.
     * ============================================================
     */
    if (
      action ===
      'confirm_identity'
    ) {
      if (
        operation.step !==
        'confirm_identity'
      ) {
        return errorResponse(
          'Cette étape n’est pas autorisée.'
        );
      }

      const target =
        await getAgentLoanRepaymentTarget(
          operation.clientWalletId,
          operation.loanCurrency
        );

      if (!target?.success) {
        return errorResponse(
          target?.error ||
            'Client ou prêt introuvable.'
        );
      }

      if (
        Number(target.loan?.id) !==
        Number(operation.loanId)
      ) {
        return errorResponse(
          'Le prêt associé à cette opération n’est plus disponible.'
        );
      }

      const debt =
        money(
          target.loan
            ?.remaining_balance
        );

      if (debt <= 0) {
        return errorResponse(
          'Ce prêt ne présente aucun solde restant.'
        );
      }

      const next =
        nextToken(
          operation,
          {
            step:
              'amount',

            debtBefore:
              debt,
          }
        );

      return NextResponse.json({
        success: true,

        operationId:
          next,

        operation:
          'agent_loan_repayment',

        step:
          'confirm_identity',

        nextStep:
          'amount',

        client:
          clientIdentity(target),

        loan: {
          id:
            target.loan.id,

          currency:
            target.loan.currency,

          remainingBalance:
            debt,
        },
      });
    }

    /*
     * ============================================================
     * AMOUNT
     * ============================================================
     */
    if (
      action === 'amount'
    ) {
      if (
        operation.step !==
        'amount'
      ) {
        return errorResponse(
          'Cette étape n’est pas autorisée.'
        );
      }

      const currency =
        String(
          body?.currency ||
            operation.loanCurrency ||
            ''
        )
          .trim()
          .toUpperCase() as Currency;

      const amount =
        money(body?.amount);

      if (
        !CURRENCIES.includes(
          currency
        )
      ) {
        return errorResponse(
          'Devise invalide.'
        );
      }

      if (amount <= 0) {
        return errorResponse(
          'Montant invalide.'
        );
      }

      /*
       * Recharge le prêt depuis le serveur.
       */
      const target =
        await getAgentLoanRepaymentTarget(
          operation.clientWalletId,
          currency
        );

      if (!target?.success) {
        return errorResponse(
          target?.error ||
            'Client ou prêt introuvable.'
        );
      }

      if (
        Number(target.loan?.id) !==
        Number(operation.loanId)
      ) {
        return errorResponse(
          'Le prêt associé à cette opération n’est plus disponible.'
        );
      }

      const debt =
        money(
          target.loan
            ?.remaining_balance
        );

      if (amount > debt) {
        return errorResponse(
          `Le montant dépasse la dette restante (${debt.toFixed(
            2
          )} ${currency}).`
        );
      }

      const next =
        nextToken(
          operation,
          {
            step:
              'confirm_amount',

            currency,

            amount,

            debtBefore:
              debt,

            debtAfter:
              money(
                debt - amount
              ),
          }
        );

      return NextResponse.json({
        success: true,

        operationId:
          next,

        operation:
          'agent_loan_repayment',

        step:
          'confirm_amount',

        nextStep:
          'confirm_amount',

        amount,

        currency,

        debtBefore:
          debt,

        debtAfter:
          money(
            debt - amount
          ),

        client: {
          userId:
            operation.clientUserId,

          walletId:
            operation.clientWalletId,
        },

        loan: {
          id:
            operation.loanId,
        },
      });
    }

    /*
     * ============================================================
     * CONFIRM AMOUNT
     *
     * On recharge encore le prêt avant de demander le PIN.
     * ============================================================
     */
    if (
      action ===
      'confirm_amount'
    ) {
      if (
        operation.step !==
        'confirm_amount'
      ) {
        return errorResponse(
          'Cette étape n’est pas autorisée.'
        );
      }

      if (
        !operation.currency ||
        !operation.amount
      ) {
        return errorResponse(
          'Données du remboursement incomplètes.'
        );
      }

      const target =
        await getAgentLoanRepaymentTarget(
          operation.clientWalletId,
          operation.currency
        );

      if (!target?.success) {
        return errorResponse(
          target?.error ||
            'Client ou prêt introuvable.'
        );
      }

      if (
        Number(target.loan?.id) !==
        Number(operation.loanId)
      ) {
        return errorResponse(
          'Le prêt associé à cette opération n’est plus disponible.'
        );
      }

      const debt =
        money(
          target.loan
            ?.remaining_balance
        );

      if (
        operation.amount >
        debt
      ) {
        return errorResponse(
          `Le montant dépasse maintenant la dette restante (${debt.toFixed(
            2
          )} ${operation.currency}).`
        );
      }

      const next =
        nextToken(
          operation,
          {
            step: 'pin',

            debtBefore:
              debt,

            debtAfter:
              money(
                debt -
                  operation.amount
              ),
          }
        );

      return NextResponse.json({
        success: true,

        operationId:
          next,

        operation:
          'agent_loan_repayment',

        step: 'pin',

        nextStep: 'pin',

        amount:
          operation.amount,

        currency:
          operation.currency,

        debtBefore:
          debt,

        debtAfter:
          money(
            debt -
              operation.amount
          ),
      });
    }

    /*
     * ============================================================
     * PIN
     *
     * C'est seulement ici que le moteur
     * repayLoanByAgent() est appelé.
     * ============================================================
     */
    if (
      action === 'pin'
    ) {
      if (
        operation.step !==
        'pin'
      ) {
        return errorResponse(
          'Cette étape n’est pas autorisée.'
        );
      }

      if (
        !operation.currency ||
        !operation.amount
      ) {
        return errorResponse(
          'Données du remboursement incomplètes.'
        );
      }

      const pin =
        String(
          body?.pin || ''
        );

      if (
        !/^\d{4}$/.test(pin)
      ) {
        return errorResponse(
          'Le PIN doit contenir exactement 4 chiffres.'
        );
      }

      /*
       * Recharge une dernière fois le prêt.
       */
      const target =
        await getAgentLoanRepaymentTarget(
          operation.clientWalletId,
          operation.currency
        );

      if (!target?.success) {
        return errorResponse(
          target?.error ||
            'Client ou prêt introuvable.'
        );
      }

      if (
        Number(target.loan?.id) !==
        Number(operation.loanId)
      ) {
        return errorResponse(
          'Le prêt associé à cette opération n’est plus disponible.'
        );
      }

      const debt =
        money(
          target.loan
            ?.remaining_balance
        );

      if (
        operation.amount >
        debt
      ) {
        return errorResponse(
          `Le montant dépasse la dette restante (${debt.toFixed(
            2
          )} ${operation.currency}).`
        );
      }

      /*
       * Moteur financier existant.
       * Aucune logique financière SQL n'est dupliquée ici.
       */
      const result =
        await repayLoanByAgent({
          agentId:
            Number(user.id),

          clientId:
            Number(
              target.client.id
            ),

          loanId:
            Number(
              target.loan.id
            ),

          amount:
            operation.amount,

          currency:
            operation.currency,

          pin,
        });

      if (!result.success) {
        return errorResponse(
          result.error ||
            'Remboursement impossible.'
        );
      }

      const next =
        nextToken(
          operation,
          {
            step:
              'completed',

            debtBefore:
              debt,

            debtAfter:
              money(
                result.remaining
              ),
          }
        );

      return NextResponse.json({
        success: true,

        operationId:
          next,

        operation:
          'agent_loan_repayment',

        step:
          'completed',

        nextStep: null,

        reference:
          result.reference,

        paid:
          money(
            result.paid
          ),

        currency:
          result.currency ||
          operation.currency,

        commission:
          money(
            result.commission
          ),

        debtRemaining:
          money(
            result.remaining
          ),

        client:
          clientIdentity(
            target
          ),

        loan: {
          id:
            target.loan.id,
        },
      });
    }

    return errorResponse(
      'Action invalide.'
    );
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
