'use server';

import type { User, Product, Boutique, Seller, ProductVariation } from '@/lib/types';
import { db } from '../db';
import { handleDbError, saveBase64Image, getUserFromDb } from './helpers';
import { verifyUserPin, verifyCurrentUserPin, verifyOtp, sendAndStoreOtp } from './auth.actions';
import { createTransaction, sendTransactionNotifications } from './transaction.actions';
import { generateReferenceCode, formatUser, currentPrice, countryToCode } from '../utils';
import type { PoolClient } from 'pg';
import { headers } from 'next/headers';
import UAParser from 'ua-parser-js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import crypto from 'crypto';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { sendWhatsAppTextMessage } from '@/services/whatsapp';
import { processMaxiCashMobilePayment, processMaxiCashPayout } from '@/services/maxicash';

const safeParse = (val: any, fallback: any) => {
    if (val === null || val === undefined) return fallback;
    if (typeof val !== 'string') return val;
    try {
        return JSON.parse(val);
    } catch (e) {
        if (typeof val === 'string' && (val.startsWith('/') || val.startsWith('http'))) return [val];
        return fallback;
    }
};

export async function addOrUpdateProduct(productData: Partial<Product>, agentId: number): Promise<{ success: boolean; product?: Product; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { id, images, isbn10, isbn13, ...dataToSave } = productData;
        
        const imageUrls = [];
        if (images && images.length > 0) {
            for (const base64Data of images) {
                if (base64Data && base64Data.startsWith('data:image')) {
                    const savedFile = await saveBase64Image(base64Data, 'jojo/produits', `product_${agentId}_${Date.now()}`);
                    if (!savedFile) throw new Error("Échec de l'enregistrement d'une des images.");
                    imageUrls.push(savedFile);
                } else if (base64Data) {
                    imageUrls.push(base64Data);
                }
            }
        }
        
        let finalDetails = (dataToSave as any).details || {};
        // Store ISBN in details object as columns don't exist in DB
        finalDetails.isbn10 = isbn10;
        finalDetails.isbn13 = isbn13;

        if (dataToSave.categoryId === 'cat-livre') {
            if (finalDetails.pdfUrl?.startsWith('data:application/pdf')) {
                finalDetails.pdfUrl = await saveBase64Image(finalDetails.pdfUrl, 'jojo/library', `book_${agentId}_${Date.now()}`);
            }
            if (finalDetails.sourceUrl?.startsWith('data:')) {
                finalDetails.sourceUrl = await saveBase64Image(finalDetails.sourceUrl, 'jojo/masters', `source_${agentId}_${Date.now()}`);
            }
            if (finalDetails.audioUrl?.startsWith('data:audio')) {
                finalDetails.audioUrl = await saveBase64Image(finalDetails.audioUrl, 'jojo/audiobooks', `audio_${agentId}_${Date.now()}`);
            }
        }

        const values = [
            agentId,                                    // $1
            dataToSave.boutiqueId ? parseInt(dataToSave.boutiqueId, 10) : null, // $2
            dataToSave.name,                            // $3
            dataToSave.description || '',               // $4
            JSON.stringify(imageUrls),                  // $5
            dataToSave.purchasePrice ?? 0,              // $6
            dataToSave.sellingPrice,                    // $7
            dataToSave.weight ?? 0,                     // $8
            dataToSave.shippingRates ? JSON.stringify(dataToSave.shippingRates) : null, // $9
            dataToSave.promotionalPackages ? JSON.stringify(dataToSave.promotionalPackages) : null, // $10
            dataToSave.variations ? JSON.stringify(dataToSave.variations) : null, // $11
            dataToSave.barcode,                         // $12
            dataToSave.stock || 0,                      // $13
            dataToSave.categoryId,                      // $14
            dataToSave.isPublic || false,               // $15
            JSON.stringify(finalDetails)                // $16
        ];

        let productId = id;
        if (productId) {
            await connection.query(`
                UPDATE products 
                SET agent_id = $1, boutique_id = $2, name = $3, description = $4, images = $5, 
                    purchase_price = $6, selling_price = $7, weight = $8, shipping_rates = $9, 
                    promotional_packages = $10, variations = $11, barcode = $12, stock = $13, 
                    category_id = $14, is_public = $15, details = $16
                WHERE id = $17 AND agent_id = $18`, 
                [...values, productId, agentId]);
        } else {
            const { rows } = await connection.query(`
                INSERT INTO products (agent_id, boutique_id, name, description, images, purchase_price, selling_price, weight, shipping_rates, promotional_packages, variations, barcode, stock, category_id, is_public, details) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`, 
                values);
            productId = rows[0].id;
        }

        await connection.query('COMMIT');
        
        const { rows: finalRows } = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
        const row = finalRows[0];
        const details = safeParse(row.details, {});
        const resultProduct: Product = {
            ...row,
            id: row.id.toString(),
            images: safeParse(row.images, []),
            sellingPrice: parseFloat(row.selling_price),
            stock: Number(row.stock),
            details,
            isbn10: details.isbn10,
            isbn13: details.isbn13,
            seller: { id: agentId.toString(), name: 'Vous' }
        };

        return { success: true, product: resultProduct };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message || "Erreur d'enregistrement." };
    } finally {
        connection.release();
    }
}

export async function getAgentProducts(agentId: number): Promise<Product[]> {
    try {
        const { rows } = await db.query(`
            SELECT p.*, b.name as "boutiqueName"
            FROM products p
            LEFT JOIN boutiques b ON p.boutique_id = b.id
            WHERE p.agent_id = $1
            ORDER BY p.created_at DESC
        `, [agentId]);
        
        return rows.map(row => {
            const details = safeParse(row.details, {});
            return {
                id: row.id.toString(),
                name: row.name,
                description: row.description,
                image: safeParse(row.images, [])[0] || 'https://placehold.co/100x100.png',
                images: safeParse(row.images, []),
                purchasePrice: parseFloat(row.purchase_price),
                sellingPrice: parseFloat(row.selling_price),
                currency: 'USD',
                weight: parseFloat(row.weight),
                shippingRates: safeParse(row.shipping_rates, []),
                promotionalPackages: safeParse(row.promotional_packages, null),
                variations: safeParse(row.variations, []),
                barcode: row.barcode,
                isbn10: details.isbn10,
                isbn13: details.isbn13,
                stock: Number(row.stock),
                categoryId: row.category_id,
                boutiqueId: row.boutique_id?.toString() || '',
                boutiqueName: row.boutiqueName,
                isPublic: Boolean(row.is_public),
                details,
                seller: { id: agentId.toString(), name: 'Agent' }
            };
        });
    } catch (error) {
        return [];
    }
}

export async function deleteProduct(productId: string, agentId: number): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows } = await connection.query('SELECT stock, purchase_price, name FROM products WHERE id = $1 AND agent_id = $2 FOR UPDATE', [productId, agentId]);
        
        if (rows.length > 0) {
            const product = rows[0];
            if (parseFloat(product.stock) > 0 && parseFloat(product.purchase_price) > 0) {
                const lossValue = parseFloat(product.stock) * parseFloat(product.purchase_price);
                await connection.query('INSERT INTO product_losses (agent_id, product_id, product_name, quantity, loss_value) VALUES ($1, $2, $3, $4, $5)', 
                    [agentId, productId, product.name, product.stock, lossValue]);
            }
        }

        await connection.query('DELETE FROM products WHERE id = $1 AND agent_id = $2', [productId, agentId]);
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function agentDeposit(args: {
  agent: User;
  clientWalletId: string;
  amount: number;
  currency: string;
  agentPin: string;
}): Promise<{ success: boolean; error?: string; agentNewBalance?: number }> {
  const { agent: partialAgent, clientWalletId, amount, currency, agentPin } = args;
  
  const pinVerification = await verifyUserPin(partialAgent.id, agentPin);
  if (!pinVerification.success) return { success: false, error: pinVerification.error };
  
  const connection = await db.getConnection();
  try {
    await connection.query('BEGIN');

    const { rows: agentRows } = await connection.query('SELECT * FROM users WHERE id = $1', [partialAgent.id]);
    if (agentRows.length === 0) throw new Error('Agent non trouvé.');
    const agent = formatUser(agentRows[0]);

    const { rows: clientRows } = await connection.query('SELECT * FROM users id_wallet = $1', [clientWalletId]);
    if (clientRows.length === 0) throw new Error('Client non trouvé.');
    const client = formatUser(clientRows[0]);

    const agentTx = await createTransaction({
        user: agent, typeCode: 'DP_AGENT', amount, currency,
        description: `Dépôt pour client ${client.full_name}`,
        metadata: { client_wallet_id: clientWalletId }, connection
    });
    if (!agentTx.success) throw new Error(agentTx.error);

    const clientTx = await createTransaction({
        user: client, typeCode: 'DP', amount, currency,
        description: `Dépôt reçu de l'agent ${agent.full_name}`,
        metadata: { agent_id: agent.id }, connection
    });
    if (!clientTx.success) throw new Error(clientTx.error);

    await connection.query('COMMIT');
    return { success: true, agentNewBalance: agentTx.senderNewBalance };
  } catch (error: any) {
    await connection.query('ROLLBACK');
    return { success: false, error: error.message || "Une erreur est survenue lors du dépôt." };
  } finally {
    connection.release();
  }
}

/**
 * Traite une vente par scan (POS).
 * Supporte le paiement dans une devise différente de celle du produit.
 */
export async function processQrSale(buyerUserId: number, orderPayload: any) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows: buyerRows } = await connection.query('SELECT * FROM users WHERE id = $1', [buyerUserId]);
        const buyer = buyerRows[0];
        
        const { rows: sellerRows } = await connection.query('SELECT * FROM users WHERE id_wallet = $1', [orderPayload.sellerWalletId]);
        const seller = sellerRows[0];

        if (!seller) throw new Error("Vendeur introuvable.");

        // On utilise createTransaction qui gère maintenant sourceCurrency et les frais TR pour POS_SALE
        const tx = await createTransaction({
            user: buyer, 
            typeCode: 'POS_SALE', 
            amount: orderPayload.amount, 
            currency: orderPayload.currency,
            sourceCurrency: orderPayload.paymentCurrency, // Devise de débit choisie par le client
            description: `Achat POS à ${orderPayload.boutiqueName || 'Magasin'}`,
            metadata: { ...orderPayload }, 
            receiver_id: seller.id,
            connection
        });
        
        if (!tx.success) throw new Error(tx.error);
        
        for (const item of orderPayload.items || []) {
            const { rows: prodRows } = await connection.query('SELECT variations, stock FROM products WHERE id = $1 FOR UPDATE', [item.id]);
            if (prodRows.length > 0) {
                const prod = prodRows[0];
                const availableStock = Number(prod.stock || 0);
                
                if (availableStock < item.quantity) {
                    throw new Error(`Stock insuffisant pour ${prod.name}.`);
                }

                const vars = safeParse(prod.variations, []);
                // Si des variations existent, on tente de les mettre à jour
                if (vars.length > 0) {
                    let qtyToDeduct = item.quantity;
                    for (let v of vars) {
                        if (qtyToDeduct > 0 && v.stock > 0) {
                            const toDeduct = Math.min(qtyToDeduct, v.stock);
                            v.stock -= toDeduct;
                            qtyToDeduct -= toDeduct;
                        }
                    }
                }
                await connection.query('UPDATE products SET variations = $1, stock = stock - $2 WHERE id = $3', [JSON.stringify(vars), item.quantity, item.id]);
            }
        }
        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}

export async function getAgentBoutiques(agentId: number):
Promise<(Boutique & { whatsapp_public_number?: string | null })[]> {
    const { rows } = await db.query(
        'SELECT id, name, address, whatsapp_public_number FROM boutiques WHERE agent_id = $1',
        [agentId]
    );

    return rows.map(r => ({
        id: r.id.toString(),
        name: r.name,
        address: r.address,
        whatsapp_public_number: r.whatsapp_public_number
    }));
}

export async function addOrUpdateBoutique(
    data: Partial<Boutique> & { whatsapp_public_number?: string | null },
    agentId: number
) {
    if (data.id) {
        const { rows } = await db.query(
            `UPDATE boutiques
             SET name = $1,
                 address = $2,
                 whatsapp_public_number = $3
             WHERE id = $4
               AND agent_id = $5
             RETURNING id, name, address, whatsapp_public_number`,
            [
                data.name,
                data.address,
                data.whatsapp_public_number || null,
                data.id,
                agentId
            ]
        );

        if (!rows.length) {
            return {
                success: false,
                error: 'Boutique introuvable ou accès non autorisé.'
            };
        }

        return {
            success: true,
            boutique: {
                id: rows[0].id.toString(),
                name: rows[0].name,
                address: rows[0].address,
                whatsapp_public_number: rows[0].whatsapp_public_number
            }
        };
    }

    const { rows } = await db.query(
        `INSERT INTO boutiques
            (agent_id, name, address, whatsapp_public_number)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, address, whatsapp_public_number`,
        [
            agentId,
            data.name,
            data.address,
            data.whatsapp_public_number || null
        ]
    );

    return {
        success: true,
        boutique: {
            id: rows[0].id.toString(),
            name: rows[0].name,
            address: rows[0].address,
            whatsapp_public_number: rows[0].whatsapp_public_number
        }
    };
}

export async function deleteBoutique(id: string, agentId: number) {
    await db.query('DELETE FROM boutiques WHERE id = $1 AND agent_id = $2', [id, agentId]);
    return { success: true };
}

export async function getAgentSellers(agentId: number): Promise<Seller[]> {
    const { rows } = await db.query(`
        SELECT u.*, asf.role, asf.is_active, asf.start_date, asf.agency_id as "boutiqueId", b.name as "boutiqueName"
        FROM users u
        JOIN agency_staff asf ON u.id = asf.user_id
        JOIN boutiques b ON asf.agency_id = b.id
        WHERE b.agent_id = $1
    `, [agentId]);
    return rows.map(row => ({
        id: row.id, fullName: row.full_name, id_wallet: row.id_wallet, profile_photo: row.profile_photo,
        phone: row.phone, role: row.role, status: row.is_active ? 'Active' : 'Inactive',
        createdAt: new Date(row.start_date).toISOString(), boutiqueId: row.boutiqueId.toString(), boutiqueName: row.boutiqueName, totalSales: 0
    }));
}

export async function addOrUpdateSeller(data: Partial<Seller>, agentId: number) {
    const { rows: user } = await db.query('SELECT id FROM users WHERE id_wallet = $1', [data.id_wallet]);
    if (!user.length) return { success: false, error: 'User not found' };
    await db.query(`
        INSERT INTO agency_staff (agency_id, user_id, role, is_active) 
        VALUES ($1, $2, $3, true)
        ON CONFLICT (user_id, agency_id) DO UPDATE SET role = EXCLUDED.role
    `, [data.boutiqueId, user[0].id, data.role]);
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [user[0].id]);
    return { success: true, seller: { ...data, fullName: rows[0].full_name, id: rows[0].id } };
}

export async function deleteSeller(id: number, agentId: number) {
    await db.query('DELETE FROM agency_staff WHERE user_id = $1', [id]);
    return { success: true };
}

export async function getAgentApiDetails(agentId: number) {
    const { rows } = await db.query('SELECT api_key as "apiKey", api_secret as "apiSecret" FROM users WHERE id = $1', [agentId]);
    return rows[0];
}

export async function resetAgentApiSecret(agentId: number) {
    const secret = `csk_sec_${crypto.randomBytes(16).toString('hex')}`;
    await db.query('UPDATE users SET api_secret = $1 WHERE id = $2', [secret, agentId]);
    return { success: true, newSecret: secret };
}

export async function getAgentSalesHistory(agentId: number, filters: any) {
    let sql = `
        SELECT t.*, u.full_name as "buyerName", u.id_wallet as "buyerWalletId"
        FROM transactions t 
        LEFT JOIN users u ON t.sender_id = u.id 
        WHERE t.receiver_id = $1 AND t.type_code IN ('POS_SALE', 'SALE')
    `;
    const params: any[] = [agentId];
    let paramIndex = 2;

    if (filters.referenceCode) {
        sql += ` AND t.reference_code ILIKE $${paramIndex++}`;
        params.push(`%${filters.referenceCode}%`);
    }

    if (filters.walletId) {
        sql += ` AND u.id_wallet ILIKE $${paramIndex++}`;
        params.push(`%${filters.walletId}%`);
    }

    if (filters.startDate) {
        sql += ` AND t.created_at >= $${paramIndex++}`;
        params.push(filters.startDate);
    }

    if (filters.endDate) {
        sql += ` AND t.created_at <= $${paramIndex++}`;
        params.push(filters.endDate);
    }

    sql += ` ORDER BY t.created_at DESC LIMIT 100`;

    try {
        const { rows } = await db.query(sql, params);
        return { 
            success: true, 
            data: rows.map(r => ({ 
                ...r, 
                reference: r.reference_code, 
                total_amount: r.amount, 
                date: r.created_at, 
                transaction_status: r.status,
                items: safeParse(r.metadata?.items || r.metadata?.productIds, []),
                transaction_metadata: r.metadata,
                buyerName: r.buyerName || 'Client Inconnu'
            })) 
        };
    } catch (error) {
        console.error("Error in getAgentSalesHistory:", error);
        return { success: false, data: [] };
    }
}

export async function getSellerById(id: number) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = formatUser(rows[0]);
    return { success: true, seller: { ...user, fullName: user.full_name, boutiqueId: '', boutiqueName: '', totalSales: 0, role: 'Vendeur', status: 'Active', createdAt: '' } as Seller };
}

export async function getCasinoHistory(walletId: string, range: any) {
    return { success: true, data: [] };
}

export async function initiateMobileMoneyCollection(args: {
    agent: User;
    agentPin: string;
    operator: string;
    customerPhone: string;
    amount: number;
    currency: string;
}) {
    const { agent, agentPin, operator, customerPhone, amount, currency } = args;
    const pinVerification = await verifyCurrentUserPin(agentPin);
    if (!pinVerification.success) return { success: false, error: pinVerification.error };

    const reference = generateReferenceCode('AG_COLL');

    try {
        const result = await processMaxiCashMobilePayment({
            amount,
            currency,
            phoneNumber: customerPhone,
            operator,
            reference,
            countryCode: countryToCode(agent.country) || 'CD',
            user: agent
        });

        if (result.success) {
            await createTransaction({
                user: agent,
                typeCode: 'WD_AGENT_PENDING',
                amount,
                currency,
                description: `Encaissement Mobile (${operator}) de ${customerPhone} pour retrait cash`,
                metadata: { 
                    customerPhone, 
                    operator, 
                    reference, 
                    is_agent_collection: true,
                    provider_tx_id: result.data?.transactionId 
                },
                status: 'Pending',
                referenceCode: reference
            });

            return { 
                success: true, 
                message: `Demande de paiement envoyée au client (${customerPhone}). Une fois validée, votre portefeuille sera crédité et vous pourrez lui remettre les espèces.` 
            };
        } else {
            return { success: false, error: result.message || "Échec de l'initiation du paiement mobile." };
        }
    } catch (e: any) {
        return { success: false, error: "Erreur de communication avec le réseau de paiement." };
    }
}

export interface ActionResult {
    success: boolean;
    error?: string;
}

export async function confirmSaleByCode(args: any): Promise<ActionResult> {
    return { success: true };
}

export async function initiateClientTransfer(args: { senderWalletId: string; amount: number; currency: string; agentName: string }) {
    const { senderWalletId, amount, currency, agentName } = args;
    const user = await getUserFromDb({ walletId: senderWalletId });
    if (!user) return { success: false, error: 'Expéditeur non trouvé.' };
    return await sendAndStoreOtp(user.id, `un transfert de ${amount} ${currency} (via agent ${agentName})`, 'sms');
}

export async function confirmClientTransfer(args: { senderWalletId: string; recipientWalletId: string; amount: number; currency: string; code: string; method: string }) {
    const { senderWalletId, recipientWalletId, amount, currency, code, method } = args;
    const sender = await getUserFromDb({ walletId: senderWalletId });
    if (!sender) return { success: false, error: 'Expéditeur non trouvé.' };
    const recipient = await getUserFromDb({ walletId: recipientWalletId });
    if (!recipient) return { success: false, error: 'Destinataire non trouvé.' };
    const otpVerification = await verifyOtp(sender.id, code);
    if (!otpVerification.success) return { success: false, error: 'Code de validation incorrect.' };
    return await createTransaction({
        user: sender,
        typeCode: 'TR',
        amount,
        currency,
        description: `Transfert à ${recipient.full_name} (via Agent)`,
        receiver_id: recipient.id,
        receiver_wallet_id: recipient.id_wallet,
        metadata: { facilitator: 'agent' }
    });
}

export async function initiateClientWithdrawalOtp(args: {
    clientWalletId: string;
    amount: number;
    currency: string;
    channel: 'sms' | 'email' | 'whatsapp';
    agentName?: string;
}) {
    const client = await getUserFromDb({
        walletId: args.clientWalletId
    });

    if (!client) {
        return {
            success: false,
            error: 'Client non trouvé.'
        };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otpType = 'agent_withdrawal';
    const amountText = `${args.amount} ${args.currency}`;
    const agentText = args.agentName || 'Agent CashPay';

    try {
        await db.query(
            `INSERT INTO otps
                (user_id, code, type, channel, expires_at)
             VALUES
                ($1::integer, $2::text, $3::text, $4::text, $5::timestamp)`,
            [
                client.id,
                otp,
                otpType,
                args.channel,
                expiresAt
            ]
        );

        const headerList = await headers();
        const ip = (headerList.get('x-forwarded-for') ?? '127.0.0.1')
            .split(',')[0]
            .trim();

        const userAgentString = headerList.get('user-agent') ?? '';
        const countryFromHeader =
            headerList.get('x-vercel-ip-country') || client.country || '';

        const parser = new UAParser(userAgentString);
        const uaResult = parser.getResult();

        let deviceType = uaResult.device.type || 'Ordinateur';
        if (deviceType === 'mobile' || deviceType === 'tablet') {
            deviceType = uaResult.device.vendor
                ? `${uaResult.device.vendor} ${uaResult.device.model}`
                : 'Mobile';
        } else {
            deviceType = 'Ordinateur';
        }

        const expirationText = '10 minutes';

        const smsMessage =
            `CashPay - Retrait Cash\n` +
            `Montant : ${amountText}\n` +
            `Agent : ${agentText}\n` +
            `Code de retrait : ${otp}\n` +
            `Valable ${expirationText}. Ne partagez jamais ce code.`;

        const whatsappMessage =
            `*CashPay - Retrait Cash*\n` +
            `Montant : ${amountText}\n` +
            `Agent : ${agentText}\n\n` +
            `Votre code de retrait : *${otp}*\n` +
            `Valable pendant ${expirationText}.\n` +
            `Ne partagez jamais ce code.`;

        const emailData = {
            title: 'Confirmation de retrait CashPay',
            greeting: `Bonjour ${client.first_name || 'Client'},`,
            intro:
                `Une demande de retrait Cash a été initiée pour ` +
                `<strong>${amountText}</strong> auprès de ` +
                `<strong>${agentText}</strong>.<br><br>` +
                `Votre code de retrait est :`,
            otpCode: otp,
            warning:
                `Ce code est valable pendant ${expirationText}. ` +
                `Il autorise la validation de ce retrait uniquement. ` +
                `Ne le communiquez à personne.`,
            signature: "L'équipe de sécurité CashPay",
            ipAddress: ip,
            deviceType,
            browser: `${uaResult.browser.name || ''} ${uaResult.browser.version || ''}`.trim(),
            operatingSystem: `${uaResult.os.name || ''} ${uaResult.os.version || ''}`.trim(),
            location: countryFromHeader,
            loginTime: format(
                new Date(),
                "d MMMM yyyy 'à' HH:mm:ss",
                { locale: fr }
            )
        };

        let destination = '';
        let sendSuccess = false;
        let sendMessage = '';

        if (args.channel === 'email') {
            if (!client.email) {
                return {
                    success: false,
                    error: 'Adresse email du client indisponible.',
                    backupOtp: otp,
                    userId: client.id
                };
            }

            const result = await sendEmail(
                client.email,
                'Code de retrait CashPay',
                'otp',
                emailData
            );

            destination = client.email;
            sendSuccess = result.success;
            sendMessage = result.message;

        } else if (args.channel === 'whatsapp') {
            if (!client.phone) {
                return {
                    success: false,
                    error: 'Numéro WhatsApp du client indisponible.',
                    backupOtp: otp,
                    userId: client.id
                };
            }

            const result = await sendWhatsAppTextMessage(
                client.phone,
                whatsappMessage
            );

            destination = client.phone;
            sendSuccess = result.success;
            sendMessage = result.message;

        } else {
            if (!client.phone) {
                return {
                    success: false,
                    error: 'Numéro de téléphone du client indisponible.',
                    backupOtp: otp,
                    userId: client.id
                };
            }

            const result = await sendSms(client.phone, smsMessage);

            destination = client.phone;
            sendSuccess = result.success;
            sendMessage = result.message;
        }

        if (!sendSuccess) {
            console.error(
                `[Withdrawal OTP] Échec ${args.channel} pour user ${client.id}:`,
                sendMessage
            );

            return {
                success: false,
                error: `L'envoi du code de retrait par ${args.channel} a échoué.`,
                backupOtp: otp,
                userId: client.id
            };
        }

        console.log(
            `[Withdrawal OTP] Code de retrait généré pour user ${client.id}, ` +
            `montant ${amountText}, agent "${agentText}", canal ${args.channel}.`
        );

        return {
            success: true,
            message: `Le code de retrait a été envoyé à ${destination}.`,
            destination,
            userId: client.id
        };

    } catch (error: any) {
        console.error('[Withdrawal OTP] Erreur:', error);

        return {
            success: false,
            error: error?.message || "Erreur lors de l'envoi du code de retrait.",
            userId: client.id
        };
    }
}

async function verifyClientWithdrawalOtp(
    userId: number,
    code: string
): Promise<{ success: true } | { success: false; error: string }> {
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const { rows } = await connection.query(
            `SELECT id
             FROM otps
             WHERE user_id = $1::integer
               AND code = $2::text
               AND type = 'agent_withdrawal'
               AND used = false
               AND expires_at > NOW()
             ORDER BY id DESC
             LIMIT 1
             FOR UPDATE`,
            [userId, code]
        );

        if (rows.length === 0) {
            await connection.query('ROLLBACK');
            return {
                success: false,
                error: 'Le code de retrait est invalide ou a expiré.'
            };
        }

        await connection.query(
            `UPDATE otps
             SET used = true
             WHERE id = $1::integer`,
            [rows[0].id]
        );

        await connection.query('COMMIT');

        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        console.error('[Withdrawal OTP] Erreur de vérification:', error);

        return {
            success: false,
            error: "Une erreur est survenue lors de la vérification du code de retrait."
        };
    } finally {
        connection.release();
    }
}

export async function confirmWithdrawal(args: { agent: User, clientWalletId: string, amount: number, currency: 'USD' | 'EUR' | 'CDF', code: string, method: 'otp' | 'pin' }) {
    const { agent: partialAgent, clientWalletId, amount, currency, code, method } = args;
    const client = await getUserFromDb({ walletId: clientWalletId });
    if (!client) return { success: false, error: 'Client non trouvé.' };

    if (method === 'otp') {
        const otpRes = await verifyClientWithdrawalOtp(client.id, code);
        if (!otpRes.success) return { success: false, error: otpRes.error };
    } else {
        const pinRes = await verifyUserPin(client.id, code);
        if (!pinRes.success) return { success: false, error: 'PIN incorrect.' };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows: agentRows } = await connection.query('SELECT * FROM users WHERE id = $1', [partialAgent.id]);
        if (agentRows.length === 0) throw new Error("Agent non trouvé.");
        const agent = formatUser(agentRows[0]);
        const clientTx = await createTransaction({
            user: client, typeCode: 'WD', amount, currency,
            description: `Retrait Cash chez Agent ${agent.full_name}`,
            metadata: { agent_id: agent.id }, connection
        });
        if (!clientTx.success) throw new Error(clientTx.error);
        const { rows: agentWalletRows } = await connection.query(
            `SELECT balances
             FROM wallets
             WHERE user_id = $1::integer
             FOR UPDATE`,
            [agent.id]
        );

        if (agentWalletRows.length === 0) {
            throw new Error("Portefeuille de l'agent non trouvé.");
        }

        const agentBalances =
            typeof agentWalletRows[0].balances === 'string'
                ? JSON.parse(agentWalletRows[0].balances)
                : (agentWalletRows[0].balances || {});

        agentBalances[currency] =
            Number(agentBalances[currency] || 0) + Number(amount);

        await connection.query(
            `UPDATE wallets
             SET balances = $1::jsonb
             WHERE user_id = $2::integer`,
            [JSON.stringify(agentBalances), agent.id]
        );

        // Commission spécifique au retrait agent : 33,3 % des frais du retrait.
        const withdrawalFee = Math.round(
            (Number(clientTx.fee || 0) + Number.EPSILON) * 100
        ) / 100;

        const commission = Math.round(
            (withdrawalFee * 0.3333333333 + Number.EPSILON) * 100
        ) / 100;

        if (commission > 0) {
            const { rows: commissionRows } = await connection.query(
                `SELECT commission_balance
                 FROM wallets
                 WHERE user_id = $1::integer
                 FOR UPDATE`,
                [agent.id]
            );

            if (commissionRows.length === 0) {
                throw new Error("Portefeuille de commissions de l'agent non trouvé.");
            }

            const commissionBalances =
                typeof commissionRows[0].commission_balance === 'string'
                    ? JSON.parse(commissionRows[0].commission_balance)
                    : (commissionRows[0].commission_balance || {});

            commissionBalances[currency] =
                Math.round(
                    (Number(commissionBalances[currency] || 0) +
                        commission +
                        Number.EPSILON) * 100
                ) / 100;

            await connection.query(
                `UPDATE wallets
                 SET commission_balance = $1::jsonb
                 WHERE user_id = $2::integer`,
                [JSON.stringify(commissionBalances), agent.id]
            );
        }

        // Valeurs utilisées pour la notification après validation définitive.
        const availableBalance = Number(agentBalances[currency] || 0);
        const withdrawalCommission = Number(commission || 0);

        const agentNotificationMessage =
            `CashPay : Retrait confirmé chez votre agence. ` +
            `Montant : ${Number(amount).toFixed(2)} ${currency}. ` +
            `Solde disponible : ${availableBalance.toFixed(2)} ${currency}. ` +
            `Commission gagnée : ${withdrawalCommission.toFixed(2)} ${currency}. ` +
            `Réf : ${clientTx.reference}.`;

        await connection.query('COMMIT');

    try {
      await sendTransactionNotifications(
        client,
        {
          description: `Retrait Cash effectué auprès de ${agent.full_name || agent.first_name || 'Agent'}`,
          amount: Number(amount),
          currency,
          fee: Number(clientTx.fee || 0),
          reference: String(clientTx.reference || ''),
          newBalance: Number(clientTx.senderNewBalance || 0),
          typeCode: 'WD'
        }
      );
    } catch (notificationError) {
      console.error('[Agent Withdrawal] Erreur notification client:', notificationError);
    }



        // Notification spécifique à l'agent : SMS + email uniquement.
        // Les notifications ne bloquent jamais la transaction déjà validée.
        try {
            if (agent.phone) {
                await sendSms(agent.phone, agentNotificationMessage);
            }

            if (agent.email) {
                await sendEmail(
                    agent.email,
                    'Retrait Cash confirmé - CashPay',
                    'general',
                    {
                        title: 'Retrait Cash confirmé',
                        greeting: `Bonjour ${agent.first_name || agent.full_name},`,
                        message:
                            `Un retrait Cash a été confirmé dans votre agence.<br/>` +
                            `<strong>Montant :</strong> ${Number(amount).toFixed(2)} ${currency}<br/>` +
                            `<strong>Solde disponible :</strong> ${availableBalance.toFixed(2)} ${currency}<br/>` +
                            `<strong>Commission gagnée :</strong> ${withdrawalCommission.toFixed(2)} ${currency}<br/>` +
                            `<strong>Référence :</strong> ${clientTx.reference}`,
                        buttonText: 'Voir mes transactions',
                        buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/transactions`,
                        signature: "L'équipe CashPay"
                    }
                );
            }
        } catch (notificationError) {
            console.error('[Agent Withdrawal] Erreur notification agent:', notificationError);
        }

        return { success: true };
        return { success: true };
    } catch(e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}
