import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
  getUssdRecipientInfo,
  getUssdBalance,
  executeAgentDeposit,
} from '@/lib/ussd/ussd.actions';

function money(value: unknown): number {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function errorResponse(
  message: string,
  status = 400,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...extra,
    },
    { status }
  );
}

function normalizeStep(value: unknown): string {
  return String(value || 'identify')
    .trim()
    .toLowerCase();
}

function normalizeCurrency(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function normalizeClientRef(body: any): string {
  return String(
    body?.clientWalletId ||
      body?.clientRef ||
      body?.phone ||
      ''
  ).trim();
}

function insufficientBalanceResponse(
  amount: number,
  balance: number,
  currency: string
) {
  const missingAmount = money(amount - balance);

  return errorResponse(
    'Solde agent insuffisant.',
    400,
    {
      preview: {
        amount,
        fee: 0,
        totalDebit: amount,
        balance,
        missingAmount,
        currency,
        message:
          `Il vous manque ${missingAmount.toFixed(2)} ${currency} ` +
          `pour effectuer ce dépôt.`,
      },
    }
  );
}

async function getClient(clientRef: string) {
  const clientInfo = await getUssdRecipientInfo(clientRef);

  if (!clientInfo?.success) {
    return {
      success: false,
      error:
        clientInfo?.error ||
        'Client introuvable.',
    };
  }

  if (
    String(clientInfo.role || '')
      .trim()
      .toLowerCase() === 'agent'
  ) {
    return {
      success: false,
      error:
        'Le portefeuille indiqué appartient à un agent.',
    };
  }

  return {
    success: true,
    client: clientInfo,
  };
}

export async function POST(req: NextRequest) {
  try {
    /*
     * ============================================================
     * AUTHENTIFICATION AGENT
     * ============================================================
     */
    const user = await getAuthenticatedUser();

    if (!user) {
      return errorResponse(
        'Authentification requise.',
        401
      );
    }

    const role = String(user.role || '')
      .trim()
      .toLowerCase();

    if (role !== 'agent') {
      return errorResponse(
        'Un compte Agent est requis.',
        403
      );
    }

    const body = await req.json();
    const step = normalizeStep(body?.step);

    /*
     * ============================================================
     * ÉTAPE 1 — IDENTIFIER LE CLIENT
     *
     * Android peut envoyer :
     * - clientWalletId
     * - phone
     * - clientRef
     *
     * Le moteur existant getUssdRecipientInfo() reste
     * l'identificateur serveur.
     * ============================================================
     */
    if (step === 'identify') {
      const clientRef = normalizeClientRef(body);

      if (!clientRef) {
        return errorResponse(
          'Wallet ID ou numéro de téléphone du client requis.'
        );
      }

      const clientResult =
        await getClient(clientRef);

      if (!clientResult.success) {
        return errorResponse(
          clientResult.error ||
            'Client introuvable.'
        );
      }

      const client = clientResult.client;

      return NextResponse.json({
        success: true,
        step: 'identify',
        nextStep: 'confirm_client',
        operation: 'agent_deposit',
        client: {
          userId: client.userId,
          walletId: client.walletId,
          phone: client.phone || null,
          firstName:
            client.firstName ||
            client.fullName ||
            'Client',
          fullName:
            client.fullName ||
            client.firstName ||
            'Client',
          role: client.role || null,
          status: client.status || null,
          profilePhotoUrl:
            client.profilePhotoUrl ||
            client.profilePhoto ||
            client.avatar ||
            null,
        },
      });
    }

    /*
     * ============================================================
     * ÉTAPE 2 — CONFIRMER LE CLIENT
     * ============================================================
     */
    if (step === 'confirm_client') {
      const clientRef =
        String(
          body?.clientWalletId ||
            body?.clientRef ||
            ''
        ).trim();

      if (!clientRef) {
        return errorResponse(
          'Client requis.'
        );
      }

      const clientResult =
        await getClient(clientRef);

      if (!clientResult.success) {
        return errorResponse(
          clientResult.error ||
            'Client introuvable.'
        );
      }

      const client = clientResult.client;

      return NextResponse.json({
        success: true,
        step: 'confirm_client',
        nextStep: 'amount',
        operation: 'agent_deposit',
        client: {
          userId: client.userId,
          walletId: client.walletId,
          phone: client.phone || null,
          firstName:
            client.firstName ||
            client.fullName ||
            'Client',
          fullName:
            client.fullName ||
            client.firstName ||
            'Client',
          role: client.role || null,
          status: client.status || null,
          profilePhotoUrl:
            client.profilePhotoUrl ||
            client.profilePhoto ||
            client.avatar ||
            null,
        },
      });
    }

    /*
     * ============================================================
     * ÉTAPE 3 — SAISIR LE MONTANT
     *
     * Le serveur calcule :
     * - fee
     * - totalDebit
     * - balance
     * - missingAmount
     *
     * Android ne fait aucun calcul financier.
     * ============================================================
     */
    if (step === 'amount') {
      const clientRef = normalizeClientRef(body);
      const currency =
        normalizeCurrency(body?.currency);
      const amount = money(body?.amount);

      if (!clientRef) {
        return errorResponse(
          'Client requis.'
        );
      }

      if (!currency) {
        return errorResponse(
          'Devise requise.'
        );
      }

      if (amount <= 0) {
        return errorResponse(
          'Montant invalide.'
        );
      }

      const clientResult =
        await getClient(clientRef);

      if (!clientResult.success) {
        return errorResponse(
          clientResult.error ||
            'Client introuvable.'
        );
      }

      /*
       * Aucun tableau de devises codé en dur.
       * Le solde est demandé directement au portefeuille
       * de l'agent pour la devise demandée.
       */
      const balance = money(
        await getUssdBalance(
          user.id,
          currency
        )
      );

      if (balance < amount) {
        return insufficientBalanceResponse(
          amount,
          balance,
          currency
        );
      }

      return NextResponse.json({
        success: true,
        step: 'amount',
        nextStep: 'confirm_amount',
        operation: 'agent_deposit',

        amount,
        fee: 0,
        totalDebit: amount,
        balance,
        currency,

        client: {
          userId:
            clientResult.client.userId,
          walletId:
            clientResult.client.walletId,
          firstName:
            clientResult.client.firstName ||
            clientResult.client.fullName ||
            'Client',
          fullName:
            clientResult.client.fullName ||
            clientResult.client.firstName ||
            'Client',
        },
      });
    }

    /*
     * ============================================================
     * ÉTAPE 4 — CONFIRMER LE MONTANT
     * ============================================================
     */
    if (step === 'confirm_amount') {
      const clientRef = normalizeClientRef(body);
      const currency =
        normalizeCurrency(body?.currency);
      const amount = money(body?.amount);

      if (!clientRef) {
        return errorResponse(
          'Client requis.'
        );
      }

      if (!currency) {
        return errorResponse(
          'Devise requise.'
        );
      }

      if (amount <= 0) {
        return errorResponse(
          'Montant invalide.'
        );
      }

      /*
       * Le client est revérifié côté serveur avant
       * de passer à la demande du PIN.
       */
      const clientResult =
        await getClient(clientRef);

      if (!clientResult.success) {
        return errorResponse(
          clientResult.error ||
            'Client introuvable.'
        );
      }

      const balance = money(
        await getUssdBalance(
          user.id,
          currency
        )
      );

      if (balance < amount) {
        return insufficientBalanceResponse(
          amount,
          balance,
          currency
        );
      }

      return NextResponse.json({
        success: true,
        step: 'confirm_amount',
        nextStep: 'pin',
        operation: 'agent_deposit',

        amount,
        fee: 0,
        totalDebit: amount,
        balance,
        currency,

        client: {
          userId:
            clientResult.client.userId,
          walletId:
            clientResult.client.walletId,
          firstName:
            clientResult.client.firstName ||
            clientResult.client.fullName ||
            'Client',
          fullName:
            clientResult.client.fullName ||
            clientResult.client.firstName ||
            'Client',
        },
      });
    }

    /*
     * ============================================================
     * ÉTAPE 5 — PIN + EXÉCUTION
     *
     * On utilise exactement le moteur financier existant :
     * executeAgentDeposit()
     *
     * Le PIN n'est donc pas vérifié directement ici.
     * Le moteur appelle verifyUserPin().
     * ============================================================
     */
    if (step === 'pin') {
      const clientRef = normalizeClientRef(body);
      const currency =
        normalizeCurrency(body?.currency);
      const amount = money(body?.amount);
      const pin = String(body?.pin || '').trim();

      if (!clientRef) {
        return errorResponse(
          'Client requis.'
        );
      }

      if (!currency) {
        return errorResponse(
          'Devise requise.'
        );
      }

      if (amount <= 0) {
        return errorResponse(
          'Montant invalide.'
        );
      }

      if (!/^\d{4,6}$/.test(pin)) {
        return errorResponse(
          'Le PIN doit contenir entre 4 et 6 chiffres.'
        );
      }

      /*
       * Dernière vérification du client avant opération.
       */
      const clientResult =
        await getClient(clientRef);

      if (!clientResult.success) {
        return errorResponse(
          clientResult.error ||
            'Client introuvable.'
        );
      }

      /*
       * Dernière vérification du solde avant débit.
       */
      const balance = money(
        await getUssdBalance(
          user.id,
          currency
        )
      );

      if (balance < amount) {
        return insufficientBalanceResponse(
          amount,
          balance,
          currency
        );
      }

      /*
       * Exécution du moteur financier existant.
       */
      const result =
        await executeAgentDeposit(
          user as any,
          clientRef,
          amount,
          currency,
          pin
        );

      /*
       * PIN incorrect.
       */
      if (
        !result.success &&
        String(result.error || '')
          .toLowerCase()
          .includes('pin')
      ) {
        return errorResponse(
          'Code PIN incorrect.',
          400,
          {
            step: 'pin',
            nextStep: 'pin',
            operation: 'agent_deposit',
          }
        );
      }

      /*
       * Toute autre erreur retournée par le moteur.
       */
      if (!result.success) {
        return errorResponse(
          result.error ||
            'Dépôt impossible.',
          400,
          {
            step: 'pin',
            nextStep: 'pin',
            operation: 'agent_deposit',
          }
        );
      }

      /*
       * ========================================================
       * DÉPÔT RÉUSSI
       * ========================================================
       */
      const newBalance = money(
        await getUssdBalance(
          user.id,
          currency
        )
      );

      return NextResponse.json({
        success: true,
        step: 'completed',
        nextStep: null,
        operation: 'agent_deposit',

        reference:
          result.reference || null,

        transactionId:
          result.transactionId ||
          result.id ||
          null,

        amount,
        fee: 0,
        totalDebit: amount,
        currency,

        balance: newBalance,

        client: {
          userId:
            clientResult.client.userId,
          walletId:
            clientResult.client.walletId,
          phone:
            clientResult.client.phone ||
            null,
          firstName:
            clientResult.client.firstName ||
            clientResult.client.fullName ||
            'Client',
          fullName:
            clientResult.client.fullName ||
            clientResult.client.firstName ||
            'Client',
          profilePhotoUrl:
            clientResult.client.profilePhotoUrl ||
            clientResult.client.profilePhoto ||
            null,
        },
      });
    }

    /*
     * ============================================================
     * ÉTAPE INCONNUE
     * ============================================================
     */
    return errorResponse(
      'Étape invalide. Utilisez identify, confirm_client, amount, confirm_amount ou pin.'
    );
  } catch (error: any) {
    console.error(
      '[AGENT_DEPOSIT_API]',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'Erreur interne du service de dépôt.',
        details:
          process.env.NODE_ENV === 'development'
            ? error?.message || null
            : undefined,
      },
      { status: 500 }
    );
  }
}
