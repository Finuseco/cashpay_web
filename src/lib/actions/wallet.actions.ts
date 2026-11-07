
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { countryToCode } from '../utils';
import type { PoolClient } from 'pg';

export interface WalletInfo {
    success: boolean;
    userName?: string | null;
    userId?: number | null;
    profilePhoto?: string | null;
    countryCode?: string | null;
    walletId?: string | null;
    error?: string;
}

export async function getWalletInfo(walletId: string): Promise<WalletInfo> {
  if (!walletId || walletId.length < 12) {
    return { success: false, error: 'Format d\'ID invalide.' };
  }

  try {
    const { rows } = await db.query('SELECT id, full_name, profile_photo, country FROM users WHERE id_wallet = $1', [walletId]);
    if (rows.length > 0) {
      const user = rows[0];
      const userCountryCode = countryToCode(user.country);
      if (!userCountryCode) {
        console.warn(`Could not determine country code for user ${user.id} with country name '${user.country}'. This may affect fee calculations.`);
      }
      return {
        success: true,
        userName: user.full_name,
        userId: user.id,
        profilePhoto: user.profile_photo,
        countryCode: userCountryCode,
        walletId: walletId,
      };
    }
    return { success: false, error: 'Portefeuille non trouvé.' };
  } catch (error) {
    const dbError = await handleDbError(error, 'getting wallet holder name');
    return { success: false, error: dbError.error };
  }
}

interface FeeTier {
    fee: string;
    max: number;
    min: number;
}

import { GLOBAL_FEE_TYPES, MOBILE_MONEY_WD_TYPES } from '@/lib/fee-policy';

export async function calculateTransactionFee(
  amount: number,
  currency: string,
  transactionTypeCode: string,
  countryIdentifier?: string | null,
  connection?: PoolClient
): Promise<number> {
    const conn = connection || await db.getConnection();
    try {
        const userCountryCode = countryToCode(countryIdentifier);

        const isGlobalOnly = GLOBAL_FEE_TYPES.includes(transactionTypeCode);
        let countryCodeToQuery = isGlobalOnly ? 'GBL' : (userCountryCode || 'GBL');

        if (transactionTypeCode === 'TICKET_BUY') {
            if (currency === 'USD' || currency === 'EUR') {
                countryCodeToQuery = 'GBL';
            } else {
                countryCodeToQuery = userCountryCode || 'CD';
            }
        }

        // 1. Try specified country or GBL if it's a global-only type
        let { rows } = await conn.query(
            'SELECT fee_tiers FROM fee_structures WHERE transaction_type = $1 AND currency = $2 AND country_code = $3 AND is_active = true',
            [transactionTypeCode, currency, countryCodeToQuery]
        );

        // 2. Fallback to GBL if country-specific fee was not found (and it wasn't already GBL)
        if (rows.length === 0 && countryCodeToQuery !== 'GBL') {
            const { rows: globalRows } = await conn.query(
                'SELECT fee_tiers FROM fee_structures WHERE transaction_type = $1 AND currency = $2 AND country_code = $3 AND is_active = true',
                [transactionTypeCode, currency, 'GBL']
            );
            rows = globalRows;
        }

        // 3. Special fallback for Mobile Money withdrawals to 'CD' (DRC) logic if still not found
        if (rows.length === 0 && MOBILE_MONEY_WD_TYPES.includes(transactionTypeCode) && ['USD', 'EUR'].includes(currency)) {
            const { rows: fallbackRows } = await conn.query(
                'SELECT fee_tiers FROM fee_structures WHERE transaction_type = $1 AND currency = $2 AND country_code = $3 AND is_active = true',
                [transactionTypeCode, currency, 'CD']
            );
            rows = fallbackRows;
        }

        if (rows.length === 0) {
            return 0;
        }

        const feeTiersRaw = rows[0].fee_tiers;
        const feeTiers: FeeTier[] = typeof feeTiersRaw === 'string'
            ? JSON.parse(feeTiersRaw)
            : feeTiersRaw;

        const tier = feeTiers.find(t => amount >= t.min && (t.max === 0 || amount <= t.max));

        if (!tier) {
            const flatFeeTier = feeTiers.find(t => t.min === 0 && t.max === 0);
            if (flatFeeTier) {
                if (flatFeeTier.fee.endsWith('%')) {
                     const percentage = parseFloat(flatFeeTier.fee.slice(0, -1));
                     return (amount * percentage) / 100;
                } else {
                    return parseFloat(flatFeeTier.fee);
                }
            }
            return 0;
        }

        if (tier.fee.endsWith('%')) {
            const percentage = parseFloat(tier.fee.slice(0, -1));
            return (amount * percentage) / 100;
        } else {
            return parseFloat(tier.fee);
        }

    } catch (error) {
        handleDbError(error, `calculating dynamic fee for ${countryIdentifier}`);
        return 0;
    } finally {
        if (!connection) {
            (conn as PoolClient).release();
        }
    }
}
