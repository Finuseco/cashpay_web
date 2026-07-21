

'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User } from '@/lib/types';
import type { PoolClient } from 'pg';
import { createVirtualCard as createMastercardVirtualCard } from '@/services/mastercard';
import { createVirtualCard as createVisaVirtualCard } from '@/services/visa';

export async function registerB2bPartner(userId: number, companyData: any): Promise<{ success: boolean, error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        
        const payload = {
            owner_user_id: userId,
            company_name: companyData.name,
            company_address: companyData.address,
            company_phone: companyData.phone,
            company_email: companyData.email,
            company_website: companyData.website,
            fiscal_id: companyData.nif,
            trade_register_id: companyData.rccm,
            company_size: companyData.employeeCount,
            monthly_turnover: companyData.monthlyTurnover,
            industry: companyData.industry,
            services_needed: companyData.servicesNeeded,
            developer_role: companyData.developerRole,
        };

        await connection.query(
            `INSERT INTO b2b_partners (owner_user_id, company_name, company_address, company_phone, company_email, company_website, fiscal_id, trade_register_id, company_size, monthly_turnover, industry, services_needed, developer_role)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (owner_user_id) DO UPDATE SET
                company_name = EXCLUDED.company_name,
                company_address = EXCLUDED.company_address,
                company_phone = EXCLUDED.company_phone,
                company_email = EXCLUDED.company_email,
                company_website = EXCLUDED.company_website,
                fiscal_id = EXCLUDED.fiscal_id,
                trade_register_id = EXCLUDED.trade_register_id,
                company_size = EXCLUDED.company_size,
                monthly_turnover = EXCLUDED.monthly_turnover,
                industry = EXCLUDED.industry,
                services_needed = EXCLUDED.services_needed,
                developer_role = EXCLUDED.developer_role,
                status = 'pending_verification',
                updated_at = NOW()`,
            Object.values(payload)
        );

        await connection.query('COMMIT');
        return { success: true };
    } catch (error) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'registering B2B partner');
        return { success: false, error: dbError.error };
    } finally {
        connection.release();
    }
}

export async function checkWebsiteStatus(url: string): Promise<{ success: boolean; isAccessible: boolean }> {
    try {
        const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        return { success: true, isAccessible: response.ok };
    } catch (error) {
        return { success: true, isAccessible: false };
    }
}


/**
 * Creates a virtual card for a B2B partner's client.
 * This function is called via an API endpoint by the partner.
 * 
 * @param partnerApiKey The API key of the B2B partner making the request.
 * @param clientInfo Information about the end-user for whom the card is being created.
 * @param cardDetails Details about the card to be created (e.g., currency, brand).
 * @returns A promise that resolves with the result of the card creation.
 */
export async function issuePartnerCard(
    partnerApiKey: string, 
    clientInfo: { name: string, email: string },
    cardDetails: { currency: 'USD' | 'EUR'; brand: 'visa' | 'mastercard' }
): Promise<{ success: boolean; error?: string; cardData?: any }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Authenticate the partner and get their float account details
        const { rows: partnerRows } = await connection.query(
            'SELECT id, float_wallet_id FROM b2b_partners WHERE api_key = $1 AND status = $2',
            [partnerApiKey, 'active']
        );
        if (partnerRows.length === 0) {
            throw new Error('Clé API invalide ou partenaire inactif.');
        }
        const partner = partnerRows[0];
        const floatWalletId = partner.float_wallet_id;

        // 2. Check the partner's float account balance
        const { rows: walletRows } = await connection.query('SELECT balances FROM wallets WHERE id_wallet = $1 FOR UPDATE', [floatWalletId]);
        if (walletRows.length === 0) {
            throw new Error(`Compte flotte B2B non trouvé pour le partenaire ${partner.id}.`);
        }
        const balances = JSON.parse(walletRows[0].balances || '{}');
        const cardCreationFee = 5; // Example fee in USD

        if ((balances['USD'] || 0) < cardCreationFee) {
            throw new Error('Solde du compte flotte insuffisant pour couvrir les frais de création de carte.');
        }

        // 3. Debit the partner's float account for the card fee
        balances['USD'] -= cardCreationFee;
        await connection.query('UPDATE wallets SET balances = $1 WHERE id_wallet = $2', [JSON.stringify(balances), floatWalletId]);
        
        // 4. Create the virtual card based on the specified brand.
        const mockUserForCard = { id: 0, id_wallet: `client_${partner.id}_${Date.now()}` };
        
        let cardProviderResponse;
        if (cardDetails.brand === 'visa') {
             cardProviderResponse = await createVisaVirtualCard({
                userId: mockUserForCard.id_wallet,
                currency: cardDetails.currency,
            });
        } else { // 'mastercard'
            cardProviderResponse = await createMastercardVirtualCard({
                userId: mockUserForCard.id_wallet,
                currency: cardDetails.currency,
            });
        }

        const newCardData = {
            b2b_partner_id: partner.id,
            partner_client_ref: clientInfo.email,
            card_provider_id: cardProviderResponse.id,
            card_type: 'virtuelle',
            brand: cardDetails.brand,
            currency: cardDetails.currency,
            number: cardProviderResponse.pan,
            last4: cardProviderResponse.pan.slice(-4),
            exp_month: cardProviderResponse.expiry.month,
            exp_year: cardProviderResponse.expiry.year,
            cvv_encrypted: cardProviderResponse.cvv, // Should be encrypted
            status: 'active',
        };

        // Save the new card to a separate table for partner-issued cards
        await connection.query(
            'INSERT INTO b2b_issued_cards (b2b_partner_id, partner_client_ref, card_provider_id, card_type, brand, currency, number, last4, exp_month, exp_year, cvv_encrypted, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
            Object.values(newCardData)
        );

        await connection.query('COMMIT');
        
        return { success: true, cardData: {
            pan: newCardData.number,
            expiry: `${newCardData.exp_month}/${newCardData.exp_year}`,
            cvv: newCardData.cvv_encrypted
        }};

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'issuing partner card');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}
