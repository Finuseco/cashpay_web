import { NextRequest, NextResponse } from 'next/server';

import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import {
  executeClientAgentWithdrawal,
  executeMobileMoneyTransfer,
  getUssdBalance,
} from '@/lib/ussd/ussd.actions';

const MOBILE_MONEY_TYPES: Record<string, string> = {
  MPESA: 'WD_MPESA',
  ORANGE: 'WD_ORANGE_MONEY',
  AFRIMONEY: 'WD_AFRIMONEY',
  AIRTEL: 'WD_AIRTEL_MONEY',
  MTN: 'WD_MTN_MOMO',
};

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return json({ success: false, error: 'Authentification requise.' }, 401);
    }

    const { searchParams } = new URL(request.url);
    const method = String(searchParams.get('method') || '').toLowerCase();
    const amount = Number(searchParams.get('amount'));
    const currency = String(searchParams.get('currency') || '').toUpperCase();

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ success: false, error: 'Montant invalide.' }, 400);
    }

    if (!['USD', 'EUR', 'CDF'].includes(currency)) {
      return json({ success: false, error: 'Devise non supportée.' }, 400);
    }

    let typeCode = 'WD';

    if (method === 'mobile_money') {
      const operator = String(
        searchParams.get('operator') || ''
      ).toUpperCase();

      typeCode = MOBILE_MONEY_TYPES[operator];

      if (!typeCode) {
        return json(
          { success: false, error: 'Opérateur Mobile Money non supporté.' },
          400
        );
      }
    } else if (method !== 'agent_cash') {
      return json(
        { success: false, error: 'Mode de retrait invalide.' },
        400
      );
    }

    const balance = await getUssdBalance(user.id, currency);

    const fee = await calculateTransactionFee(
      amount,
      currency,
      typeCode,
      user.country
    );

    const total = amount + fee;
    const sufficient = balance >= total;
    const missing = sufficient ? 0 : total - balance;

    return json({
      success: true,
      preview: {
        amount,
        currency,
        fee,
        total,
        balance,
        sufficient,
        missing,
        canConfirm: sufficient,
      },
    });
  } catch (error: any) {
    console.error('Withdrawal preview error:', error);

    return json(
      {
        success: false,
        error: error?.message || 'Impossible de calculer le retrait.',
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return json({ success: false, error: 'Authentification requise.' }, 401);
    }

    const body = await request.json();

    const method = String(body.method || '').toLowerCase();
    const amount = Number(body.amount);
    const currency = String(body.currency || '').toUpperCase();
    const pin = String(body.pin || '');

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ success: false, error: 'Montant invalide.' }, 400);
    }

    if (!['USD', 'EUR', 'CDF'].includes(currency)) {
      return json({ success: false, error: 'Devise non supportée.' }, 400);
    }

    if (!pin) {
      return json({ success: false, error: 'Code PIN requis.' }, 400);
    }

    if (method === 'agent_cash') {
      const agent = String(body.agent || '').trim();

      if (!agent) {
        return json({ success: false, error: 'Agent requis.' }, 400);
      }

      const result = await executeClientAgentWithdrawal(
        user,
        agent,
        amount,
        currency,
        pin
      );

      return json(result, result.success ? 200 : 400);
    }

    if (method === 'mobile_money') {
      const country = String(body.country || '').trim();
      const operator = String(body.operator || '').trim();
      const phone = String(body.phone || '').trim();
      const reference = String(
        body.reference || `MM-${Date.now()}`
      ).trim();

      if (!country || !operator || !phone) {
        return json(
          {
            success: false,
            error: 'Pays, opérateur et numéro Mobile Money requis.',
          },
          400
        );
      }

      const operatorCode = operator.toUpperCase();
      const feeTypeCode = MOBILE_MONEY_TYPES[operatorCode] || 'WD';

      const result = await executeMobileMoneyTransfer(
        user,
        amount,
        currency,
        country,
        operatorCode,
        phone,
        pin,
        reference,
        feeTypeCode
      );

      return json(result, result.success ? 200 : 400);
    }

    return json(
      { success: false, error: 'Mode de retrait invalide.' },
      400
    );
  } catch (error: any) {
    console.error('Withdrawal error:', error);

    return json(
      {
        success: false,
        error: error?.message || 'Retrait impossible.',
      },
      500
    );
  }
}
