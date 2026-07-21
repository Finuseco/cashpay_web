
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';
import { generateReferenceCode, countryToCode } from '../utils';
import type { User, FuelStation, FuelProduct, Currency, FuelToken, FuelPump, FuelTank } from '../types';
import { getExchangeRatesForCountry } from './exchange.actions';
import crypto from 'crypto';
import { badgeVariants } from '@/components/ui/badge';

/**
 * Récupère toutes les stations-service actives pour le pays de l'utilisateur.
 */
export async function getFuelStations(countryCode?: string | null): Promise<FuelStation[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                fs.id, fs.name, fs.address, fs.owner_user_id as "ownerUserId",
                fs.country_code as "countryCode", fs.province, fs.base_currency as "baseCurrency",
                (SELECT json_agg(json_build_object(
                    'id', fp.id,
                    'name', fp.name,
                    'pricePerLiter', fp.price_per_liter,
                    'currency', fs.base_currency
                )) FROM fuel_products fp WHERE fp.station_id = fs.id) as products
            FROM fuel_stations fs
            WHERE fs.status = 'active' ${countryCode ? 'AND fs.country_code = $1' : ''}
            ORDER BY fs.name ASC
        `, countryCode ? [countryCode] : []);
        return rows as FuelStation[];
    } catch (error) {
        handleDbError(error, 'fetching fuel stations');
        return [];
    }
}

/**
 * Enregistre une nouvelle station (Espace Entreprise).
 */
export async function createFuelStation(userId: number, data: any) {
    try {
        const { rows } = await db.query(`
            INSERT INTO fuel_stations (owner_user_id, name, address, country_code, province, base_currency)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, [userId, data.name, data.address, data.countryCode, data.province, data.baseCurrency]);
        
        const stationId = rows[0].id;

        // Ajouter les produits par défaut
        await db.query(`
            INSERT INTO fuel_products (station_id, name, price_per_liter)
            VALUES ($1, 'Essence', $2), ($1, 'Gasoil', $3)
        `, [stationId, data.priceEssence, data.priceGasoil]);

        return { success: true, stationId };
    } catch (error) {
        return { success: false, error: "Erreur lors de la création de la station." };
    }
}

/**
 * Traite l'achat de carburant avec conversion automatique de devise.
 * Mode : Paiement direct au pompiste.
 */
export async function purchaseFuel(args: {
    user: User;
    stationId: string;
    productId: string;
    amountToPay: number; 
    paymentCurrency: string;
    liters: number;
    pin: string;
}): Promise<{ success: boolean; error?: string; reference?: string }> {
    const { user, stationId, productId, amountToPay, paymentCurrency, liters, pin } = args;

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Vérification Sécurité
        const pinRes = await verifyCurrentUserPin(pin);
        if (!pinRes.success) throw new Error("Code PIN incorrect.");

        // 2. Infos Station et Conversion
        const { rows: stationRows } = await connection.query('SELECT * FROM fuel_stations WHERE id = $1 FOR UPDATE', [stationId]);
        if (stationRows.length === 0) throw new Error("Station introuvable.");
        const station = stationRows[0];
        const baseCurrency = station.base_currency;

        let amountForStation = amountToPay;
        let rate = 1;

        if (paymentCurrency !== baseCurrency) {
            const rates = await getExchangeRatesForCountry(countryToCode(user.country));
            const rateObj = rates.find(r => r.from_currency === paymentCurrency && r.to_currency === baseCurrency);
            if (!rateObj) throw new Error(`Taux de change ${paymentCurrency}/${baseCurrency} non disponible.`);
            rate = rateObj.rate;
            amountForStation = amountToPay * rate;
        }

        // 3. Transaction Souveraine : Débit Client -> Crédit Station
        const reference = generateReferenceCode('FUEL');
        const txResult = await createTransaction({
            user,
            typeCode: 'FUEL_BUY',
            amount: amountToPay,
            currency: paymentCurrency,
            description: `Achat Carburant (${liters.toFixed(2)}L) à ${station.name}`,
            receiver_wallet_id: station.owner_wallet_id || 'CD0100000002', 
            metadata: { 
                stationId, liters, productId, 
                convertedAmount: amountForStation, 
                targetCurrency: baseCurrency,
                rate
            },
            status: 'Completed',
            referenceCode: reference,
            connection
        });

        if (!txResult.success) throw new Error(txResult.error);

        // 4. Mise à jour automatique des stocks (Hardware feedback simulation)
        await connection.query(`
            UPDATE fuel_tanks SET current_volume = current_volume - $1 
            WHERE station_id = $2 AND product_id = $3
        `, [liters, stationId, productId]);

        await connection.query(`
            INSERT INTO fuel_transactions 
            (user_id, station_id, product_id, amount_fiat_sent, currency_fiat_sent, amount_local_received, liters, exchange_rate, reference_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [user.id, stationId, productId, amountToPay, paymentCurrency, amountForStation, liters, rate, reference]);

        await connection.query('COMMIT');
        return { success: true, reference };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Génère un jeton (Token) pour une station autonome 24h/24.
 * Les fonds sont bloqués jusqu'à l'utilisation du code sur l'automate.
 */
export async function generateFuelToken(args: {
    user: User;
    stationId: string;
    productId: string;
    amount: number;
    currency: string;
    liters: number;
    pin: string;
}): Promise<{ success: boolean; token?: string; error?: string }> {
    const { user, stationId, productId, amount, currency, liters, pin } = args;
    
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const pinRes = await verifyCurrentUserPin(pin);
        if (!pinRes.success) throw new Error("PIN incorrect.");

        // Débit immédiat du portefeuille pour bloquer les fonds
        const reference = generateReferenceCode('F_TOK');
        const tx = await createTransaction({
            user, typeCode: 'FUEL_TOKEN', amount, currency,
            description: `Génération Jeton Carburant (${liters.toFixed(2)}L)`,
            metadata: { stationId, productId, liters },
            status: 'Pending', connection
        });

        if (!tx.success) throw new Error(tx.error);

        // Génération d'un code court à 8 chiffres (format: XXXX-XXXX)
        const tokenCode = `FP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        await connection.query(`
            INSERT INTO fuel_tokens (user_id, station_id, product_id, token_code, amount, liters, currency, status, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'valid', NOW() + INTERVAL '24 hours')
        `, [user.id, stationId, productId, tokenCode, amount, liters, currency]);

        await connection.query('COMMIT');
        return { success: true, token: tokenCode };

    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

// --- Fonctions de gestion Matériel ( IoT Gateways ) ---

export async function getStationAssets(stationId: string) {
    const { rows: pumps } = await db.query('SELECT * FROM fuel_pumps WHERE station_id = $1', [stationId]);
    const { rows: tanks } = await db.query('SELECT * FROM fuel_tanks WHERE station_id = $1', [stationId]);
    return { pumps: pumps as FuelPump[], tanks: tanks as FuelTank[] };
}

/**
 * Endpoint appelé par l'automate physique pour valider un jeton.
 */
export async function validateHardwareToken(tokenCode: string, pumpId: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        
        const { rows } = await connection.query('SELECT * FROM fuel_tokens WHERE token_code = $1 AND status = \'valid\' FOR UPDATE', [tokenCode]);
        if (rows.length === 0) throw new Error("Jeton invalide ou expiré.");
        
        const token = rows[0];
        
        // Marquer comme utilisé et activer la pompe
        await connection.query('UPDATE fuel_tokens SET status = \'used\', used_at = NOW() WHERE id = $1', [token.id]);
        await connection.query('UPDATE fuel_pumps SET status = \'busy\' WHERE id = $1', [pumpId]);
        
        await connection.query('COMMIT');
        return { success: true, liters: parseFloat(token.liters), productId: token.product_id };
    } catch(e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}
