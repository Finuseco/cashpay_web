
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { Order } from '@/lib/types';
import { checkMpesaTransactionStatus } from './transaction.actions';

/**
 * Récupère la liste des commandes pour un agent spécifique.
 * Utilise des alias entre guillemets pour préserver la casse attendue par le frontend.
 */
export async function getOrdersForAgent(agentId: number): Promise<Order[]> {
    try {
        const { rows } = await db.query(`
            SELECT DISTINCT
                o.id,
                o.reference,
                o.user_id as "userId",
                o.total_amount as "totalPrice",
                o.status,
                o.created_at as "createdAt",
                t.currency,
                buyer.full_name as "buyerName"
            FROM orders o
            JOIN transactions t ON o.transaction_id = t.id
            JOIN users buyer ON o.user_id = buyer.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE p.agent_id = $1
            ORDER BY o.created_at DESC
        `, [agentId]);
        
         const orders: Order[] = await Promise.all(rows.map(async (orderRow) => {
            const { rows: itemRows } = await db.query(`
                SELECT 
                    p.name as "productName",
                    p.images,
                    u.id as "sellerId",
                    u.full_name as "sellerName",
                    oi.quantity
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                JOIN users u ON p.agent_id = u.id
                WHERE oi.order_id = $1
                LIMIT 1
            `, [orderRow.id]);

            const firstItem = itemRows[0] || { productName: 'Produit Inconnu', images: null, sellerId: 0, sellerName: 'Inconnu', quantity: 0 };
            
            let imageUrl = 'https://placehold.co/120x120.png';
            if (firstItem.images) {
                try {
                    const images = typeof firstItem.images === 'string' ? JSON.parse(firstItem.images) : firstItem.images;
                    if (Array.isArray(images) && images.length > 0) imageUrl = images[0];
                } catch (e) {
                    if (typeof firstItem.images === 'string' && firstItem.images.startsWith('/')) imageUrl = firstItem.images;
                }
            }

            return {
                id: orderRow.id.toString(),
                reference: orderRow.reference,
                userId: orderRow.userId,
                totalPrice: parseFloat(orderRow.totalPrice || 0),
                status: orderRow.status,
                createdAt: new Date(orderRow.createdAt).toISOString(),
                currency: orderRow.currency,
                productName: firstItem.productName,
                productImage: imageUrl,
                quantity: itemRows.reduce((sum, item) => sum + item.quantity, 0),
                buyerName: orderRow.buyerName,
                seller: {
                    id: firstItem.sellerId.toString(),
                    name: firstItem.sellerName
                }
            };
        }));

        return orders;

    } catch (error) {
        console.error("getOrdersForAgent error:", error);
        await handleDbError(error, 'fetching orders for agent');
        return [];
    }
}

/**
 * Récupère les détails complets d'une commande pour le panneau agent.
 * Inclut les informations de livraison et les métadonnées de transaction.
 */
export async function getOrderByIdForAgent(orderIdOrRef: string, agentId: number): Promise<Order | null> {
    try {
        const { rows: agentCheckRows } = await db.query(`
            SELECT o.id FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE (o.reference = $1 OR o.id::text = $1) AND p.agent_id = $2
            LIMIT 1
        `, [orderIdOrRef, agentId]);
        
        if (agentCheckRows.length === 0) {
            return null;
        }
        
        const validOrderId = agentCheckRows[0].id;

        const { rows: orderRows } = await db.query(`
            SELECT 
                o.id, o.reference, o.user_id as "userId", o.total_amount as "totalPrice", 
                o.status, o.created_at as "createdAt", o.shipping_cost as "shippingCost", o.vat_amount as "vatAmount",
                t.currency,
                t.status as "transactionStatus",
                t.reference_code as "transactionReference",
                buyer.full_name as "buyerName",
                buyer.phone as "buyerPhone",
                addr.address as "deliveryAddress", addr.city as "deliveryCity", addr.province as "deliveryProvince", addr.country_code as "deliveryCountry"
            FROM orders o
            JOIN transactions t ON o.transaction_id = t.id
            JOIN users buyer ON o.user_id = buyer.id
            LEFT JOIN user_addresses addr ON o.shipping_address_id = addr.id
            WHERE o.id = $1
            LIMIT 1
        `, [validOrderId]);
        
        if (orderRows.length === 0) {
            return null;
        }

        const orderData = orderRows[0];
        
        const { rows: itemRows } = await db.query(`
            SELECT oi.quantity, oi.unit_price as "unitPrice", p.id, p.name, p.images
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = $1
        `, [validOrderId]);

        return {
            id: orderData.id.toString(),
            reference: orderData.reference,
            userId: orderData.userId,
            totalPrice: parseFloat(orderData.totalPrice || 0),
            status: orderData.status,
            createdAt: new Date(orderData.createdAt).toISOString(),
            currency: orderData.currency,
            buyerName: orderData.buyerName,
            buyerPhone: orderData.buyerPhone,
            shippingAddress: {
                address: orderData.deliveryAddress,
                city: orderData.deliveryCity,
                province: orderData.deliveryProvince,
                countryCode: orderData.deliveryCountry,
            },
            shippingCost: parseFloat(orderData.shippingCost || 0),
            vatAmount: parseFloat(orderData.vat_amount || 0),
            items: itemRows.map((item: any) => {
                let img = 'https://placehold.co/90x90.png';
                if (item.images) {
                    try {
                        const imgs = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
                        if (Array.isArray(imgs) && imgs.length > 0) img = imgs[0];
                    } catch(e) {}
                }
                return {
                    id: item.id.toString(),
                    name: item.name,
                    image: img,
                    quantity: item.quantity,
                    price: parseFloat(item.unitPrice || 0),
                };
            }),
            metadata: {
                transactionStatus: orderData.transactionStatus,
                transactionReference: orderData.transactionReference,
            },
            productName: itemRows[0]?.name || '', 
            productImage: '', 
            quantity: itemRows.reduce((sum: number, i: any) => sum + i.quantity, 0),
        };
    } catch (error) {
        console.error("getOrderByIdForAgent error:", error);
        return null;
    }
}

/**
 * Met à jour le statut logistique d'une commande.
 */
export async function updateOrderStatus(orderId: string, agentId: number, status: 'shipped' | 'delivered' | 'cancelled'): Promise<{ success: boolean; error?: string }> {
    try {
        const { rows: orderRows } = await db.query(`
            SELECT o.id
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE (o.id::text = $1 OR o.reference = $1) AND p.agent_id = $2
            LIMIT 1
        `, [orderId, agentId]);

        if (orderRows.length === 0) {
            return { success: false, error: "Commande non trouvée ou vous n'avez pas la permission de la modifier." };
        }

        const validOrderId = orderRows[0].id;

        await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, validOrderId]);

        await db.query(`
            UPDATE boutiques b
            SET completed_orders_count = (
                SELECT COUNT(DISTINCT o.id)
                FROM orders o
                JOIN order_items oi ON oi.order_id = o.id
                JOIN products p ON p.id = oi.product_id
                WHERE p.boutique_id = b.id
                  AND o.status = 'delivered'
            ), updated_at = CURRENT_TIMESTAMP
            WHERE b.id IN (
                SELECT DISTINCT p.boutique_id
                FROM order_items oi
                JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = $1
                  AND p.boutique_id IS NOT NULL
            )
        `, [validOrderId]);

        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'updating order status');
        return { success: false, error: dbError.error };
    }
}


/**
 * Vérifie le statut de paiement d'une commande auprès du fournisseur (ex: M-Pesa).
 */
export async function checkPaymentStatus(orderReference: string): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
        const { rows } = await db.query(`
            SELECT t.reference_code, t.status 
            FROM orders o 
            JOIN transactions t ON o.transaction_id = t.id 
            WHERE o.reference = $1
        `, [orderReference]);

        if (rows.length === 0) return { success: false, error: "Commande non trouvée." };

        const transaction = rows[0];
        if (transaction.status === 'Pending') {
            const result = await checkMpesaTransactionStatus(transaction.reference_code);
            return { success: result.success, status: result.success ? 'Vérification lancée' : 'Toujours en attente' };
        }

        return { success: true, status: transaction.status };
    } catch (error) {
        return { success: false, error: "Erreur lors de la vérification." };
    }
}
