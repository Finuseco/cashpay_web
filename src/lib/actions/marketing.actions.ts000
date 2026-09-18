'use server';

import type { User, SmsPackage, SmsPurchase, SentSmsCampaign, Product, MarketingCampaign } from '@/lib/types';
import { sendSms } from '@/services/sms';
import { db } from '../db';
import { handleDbError, saveBase64Image } from './helpers';
import { generateReferenceCode, countryToCode, currentPrice } from '../utils';
import { format } from 'date-fns';
import { createTransaction } from './transaction.actions';
import { sendEmail } from '@/services/email';
import { verifyCurrentUserPin } from './auth.actions';
import type { PoolClient } from 'pg';
import crypto from 'crypto';


export async function getSmsBalance(userId: number): Promise<number> {
    try {
        const { rows } = await db.query('SELECT balance FROM sms_balances WHERE user_id = $1', [userId]);
        if (rows.length > 0) {
            return rows[0].balance;
        }
        await db.query('INSERT INTO sms_balances (user_id, balance) VALUES ($1, 0)', [userId]);
        return 0;
    } catch (error) {
        await handleDbError(error, 'fetching SMS balance');
        return 0;
    }
}

export async function getSmsHistory(userId: number): Promise<{ purchases: SmsPurchase[], campaigns: SentSmsCampaign[] }> {
    let purchases: SmsPurchase[] = [];
    let campaigns: SentSmsCampaign[] = [];

    try {
        const { rows: purchaseRows } = await db.query('SELECT * FROM sms_purchases WHERE user_id = $1 ORDER BY date DESC', [userId]);
        purchases = purchaseRows as SmsPurchase[];
    } catch (error: any) {
        if (error.code === '42P01') { // undefined_table
            console.warn("Table 'sms_purchases' not found, returning empty array.");
        } else {
            await handleDbError(error, 'fetching SMS purchase history');
        }
    }

    try {
        const { rows: campaignRows } = await db.query('SELECT * FROM sms_campaigns WHERE user_id = $1 ORDER BY date DESC', [userId]);
        campaigns = campaignRows as SentSmsCampaign[];
    } catch (error: any) {
        if (error.code === '42P01') { // undefined_table
            console.warn("Table 'sms_campaigns' not found, returning empty array.");
        } else {
            await handleDbError(error, 'fetching SMS campaign history');
        }
    }

    return { purchases, campaigns };
}


interface PurchaseSmsArgs {
    agentId: number;
    packageId: number;
    smsCount: number;
    price: number;
    currency: string;
    agentPin: string;
}

export async function purchaseSmsPackage(args: PurchaseSmsArgs): Promise<{ success: boolean; error?: string, newBalance?: number, newPurchase?: SmsPurchase }> {
    const { agentId, packageId, smsCount, price, currency, agentPin } = args;
    
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const { rows: agentRows } = await connection.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [agentId]);
        if (agentRows.length === 0) {
            throw new Error('Agent non trouvé.');
        }
        const agent = agentRows[0] as User;

        const pinVerification = await verifyCurrentUserPin(agentPin);
        if (!pinVerification.success) {
            throw new Error(pinVerification.error);
        }

        const { rows: walletRows } = await connection.query('SELECT balances FROM wallets WHERE user_id = $1 FOR UPDATE', [agentId]);
        if (walletRows.length === 0) {
            throw new Error("Portefeuille de l'agent non trouvé.");
        }

        const balances = typeof walletRows[0].balances === 'string' ? JSON.parse(walletRows[0].balances) : walletRows[0].balances;
        if ((balances[currency] || 0) < price) {
            throw new Error(`Solde insuffisant dans le portefeuille ${currency}.`);
        }

        balances[currency] -= price;
        await connection.query('UPDATE wallets SET balances = $1 WHERE user_id = $2', [JSON.stringify(balances), agentId]);

        const transactionData = {
            reference_code: generateReferenceCode('SB'),
            type: 'SB',
            status: 'Completed',
            amount: price,
            currency,
            fee: 0,
            description: `Achat de ${smsCount} unités SMS`,
            sender_id: agentId,
            sender_wallet_id: agent.id_wallet,
            metadata: JSON.stringify({ packageId, smsCount })
        };
        await connection.query('INSERT INTO transactions (reference_code, type, status, amount, currency, fee, description, sender_id, sender_wallet_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', Object.values(transactionData));
        
        await connection.query(`
            INSERT INTO sms_balances (user_id, balance) VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET balance = sms_balances.balance + EXCLUDED.balance
        `, [agentId, smsCount]);
        
        const { rows: balanceRows } = await connection.query('SELECT balance FROM sms_balances WHERE user_id = $1', [agentId]);
        
        await connection.query('COMMIT');

        const newPurchase: SmsPurchase = {
            id: `purchase-${Date.now()}`,
            packageId: packageId,
            smsCount: smsCount,
            price: price,
            date: new Date().toISOString(),
        };

        return { success: true, newBalance: balanceRows[0].balance, newPurchase };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'purchasing SMS package');
        return { success: false, error: error.message || dbError.error };
    } finally {
        connection.release();
    }
}

interface SendSmsCampaignArgs {
    agentId: number;
    message: string;
    recipients: { phone: string; name: string }[];
}

export async function sendMarketingSms(args: SendSmsCampaignArgs): Promise<{ success: boolean; error?: string, newBalance?: number, newCampaign?: SentSmsCampaign }> {
    const { agentId, message, recipients } = args;
    const cost = recipients.length;

    try {
        const { rows: balanceRows } = await db.query('SELECT balance FROM sms_balances WHERE user_id = $1', [agentId]);
        const currentBalance = balanceRows[0]?.balance || 0;
        if (currentBalance < cost) {
            return { success: false, error: 'Solde SMS insuffisant.' };
        }

        const sendPromises = recipients.map(recipient => {
            const personalizedMessage = message.replace(/\[Nom\]/g, recipient.name);
            return sendSms(recipient.phone, personalizedMessage);
        });
        await Promise.all(sendPromises);

        await db.query('UPDATE sms_balances SET balance = balance - $1 WHERE user_id = $2', [cost, agentId]);
        
        const newBalance = currentBalance - cost;
        const newCampaign: SentSmsCampaign = {
            id: `campaign-${Date.now()}`,
            message: message,
            recipientsCount: cost,
            costInSms: cost,
            date: new Date().toISOString(),
        };

        return { success: true, newBalance, newCampaign };
    } catch(error) {
        const dbError = await handleDbError(error, 'sending marketing SMS');
        return { success: false, error: dbError.error };
    }
}

interface ProductBoostArgs {
    agent: User;
    products: Product[];
    packageCost: number;
    pin: string;
    layoutStyle: '2-cols' | '3-cols' | 'featured';
}

/**
 * Génère le contenu HTML des produits pour l'e-mail de boost.
 */
function generateProductsHtml(products: Product[], layout: string, baseUrl: string): string {
    const columns = layout === '3-cols' ? 3 : 2;
    let html = '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">';
    
    for (let i = 0; i < products.length; i += columns) {
        html += '<tr>';
        for (let j = 0; j < columns; j++) {
            const product = products[i + j];
            if (product) {
                const price = currentPrice(product, 1);
                const imgUrl = product.image.startsWith('http') ? product.image : `${baseUrl}${product.image}`;
                html += `
                    <td style="width: ${100 / columns}%; padding: 10px; vertical-align: top;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
                            <tr>
                                <td style="padding: 0;">
                                    <a href="${baseUrl}/shopping/${product.id}" style="text-decoration: none; display: block;">
                                        <img src="${imgUrl}" alt="${product.name}" style="width: 100%; height: auto; display: block; border-top-left-radius: 8px; border-top-right-radius: 8px;" />
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px;">
                                    <h3 style="margin: 0; font-size: 14px; color: #1a202c; font-family: sans-serif;">${product.name}</h3>
                                    <p style="margin: 5px 0 0; font-weight: bold; color: #000E38; font-family: sans-serif;">$${price.toFixed(2)}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 0 10px 10px;">
                                    <a href="${baseUrl}/shopping/${product.id}" style="display: block; background-color: #FF6600; color: #ffffff !important; text-align: center; padding: 8px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 12px; font-family: sans-serif;">Voir le produit</a>
                                </td>
                            </tr>
                        </table>
                    </td>`;
            } else {
                html += `<td style="width: ${100 / columns}%;"></td>`;
            }
        }
        html += '</tr>';
    }
    html += '</table>';
    return html;
}

export async function sendProductBoostEmail(args: ProductBoostArgs): Promise<{ success: boolean; error?: string }> {
    const { agent, products, packageCost, pin, layoutStyle } = args;
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const pinVerification = await verifyCurrentUserPin(pin);
        if (!pinVerification.success) {
            throw new Error(pinVerification.error || "Code PIN incorrect.");
        }

        const agentCountryCode = countryToCode(agent.country);
        
        // Cible prioritairement le portefeuille pays, sinon GBL, sinon utilise l'ID forcé CD0100000002
        const { rows: revenueWalletRows } = await connection.query(
            "SELECT wallet_id FROM revenue_wallets WHERE revenue_type = 'transaction_fees' AND (country_code = $1 OR country_code = 'GBL') AND is_active = true ORDER BY (country_code = $1) DESC LIMIT 1",
            [agentCountryCode]
        );
        
        const revenueWalletId = revenueWalletRows.length > 0 ? revenueWalletRows[0].wallet_id : 'CD0100000002';
        
        const { rows: revenueUserRows } = await connection.query('SELECT id FROM users WHERE id_wallet = $1', [revenueWalletId]);
        const revenueUserId = revenueUserRows[0]?.id || null;
        
        // Fetch boutique name for branding
        const { rows: boutiqueRows } = await connection.query(
            "SELECT name FROM boutiques WHERE agent_id = $1 LIMIT 1",
            [agent.id]
        );
        const boutiqueName = boutiqueRows[0]?.name || "votre boutique préférée";

        const transactionResult = await createTransaction({
            user: agent,
            typeCode: 'MKTG_FEE',
            amount: packageCost,
            currency: 'USD',
            description: `Campagne e-mail pour ${products.length} produits de la boutique ${boutiqueName}.`,
            metadata: { productIds: products.map(p => p.id), layout: layoutStyle, boutiqueName },
            receiver_id: revenueUserId,
            connection,
        });

        if (!transactionResult.success) {
            throw new Error(transactionResult.error);
        }

        const campaignData = {
            agent_id: agent.id,
            package_name: `${products.length} Products`,
            package_cost: packageCost,
            layout_style: layoutStyle,
            product_ids: JSON.stringify(products.map(p => p.id)),
            status: 'sent',
        };
        await connection.query('INSERT INTO marketing_campaigns (agent_id, package_name, package_cost, layout_style, product_ids, status) VALUES ($1, $2, $3, $4, $5, $6)', Object.values(campaignData));

        await connection.query('COMMIT');
        
        console.log(`[Marketing Action] Campaign for boutique ${boutiqueName} committed. Starting immediate email dispatch.`);
        
        // Envoi immédiat des e-mails à tous les utilisateurs actifs
        const { rows: targetUsers } = await connection.query("SELECT email, first_name FROM users WHERE email IS NOT NULL AND status = 'Active'");
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.cashpay-all.com';
        const productsHtml = generateProductsHtml(products, layoutStyle, baseUrl);

        for (const recipient of targetUsers) {
            try {
                const templateKey = `product_boost_${layoutStyle}` as any;
                
                await sendEmail(recipient.email, `Découvrez les nouveautés de ${boutiqueName}`, templateKey, {
                    agentName: boutiqueName, // Template still uses agentName placeholder
                    agentCountry: agent.country || 'International',
                    agentId: agent.id,
                    base_url: baseUrl,
                    productsHtml
                });
            } catch (e) {
                console.error(`Failed to send campaign email to ${recipient.email}:`, e);
            }
        }

        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'sending product boost email');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

export async function getMarketingCampaigns(agentId: number): Promise<MarketingCampaign[]> {
    try {
        const { rows } = await db.query('SELECT * FROM marketing_campaigns WHERE agent_id = $1 ORDER BY created_at DESC', [agentId]);
        return rows.map(row => ({
            ...row,
            package_cost: parseFloat(row.package_cost)
        })) as MarketingCampaign[];
    } catch (error) {
        await handleDbError(error, 'fetching marketing campaigns');
        return [];
    }
}
