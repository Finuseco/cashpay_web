
'use server';

import type { Product, Order, User, CartItem, ProductVariation } from '@/lib/types';
import { db } from '../db';
import { handleDbError, saveBase64Image } from './helpers';
import { sendEmail } from '@/services/email';
import { getUserFromDb } from './helpers';
import { currentPrice, generateReferenceCode, formatUser } from '../utils';
import { getAuthenticatedUser, verifyCurrentUserPin } from './user.actions';
import { calculateTransactionFee } from './wallet.actions';
import { createNotification } from './notification.actions';
import { createTransaction } from './transaction.actions';
import { processMlmOrder } from './mlm.actions';

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

/**
 * Récupère les produits publics.
 */
export async function getPublicProducts(): Promise<Product[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                p.*,
                b.name as "boutiqueName",
                u.id_wallet as "sellerWalletId",
                u.id as "sellerId",
                u.full_name as "sellerName",
                u.country as "countryCode",
                CASE WHEN subs.status = 'active' AND subs.current_period_end > NOW() THEN 'active' ELSE 'inactive' END as "sellerSubscriptionStatus"
            FROM products p
            LEFT JOIN boutiques b ON p.boutique_id = b.id
            JOIN users u ON p.agent_id = u.id
            LEFT JOIN agent_subscriptions subs ON u.id = subs.user_id
            WHERE p.is_public = true 
              AND p.stock > 0 
              AND u.status = 'Active'
              AND (subs.status = 'active' OR u.role = 'Admin')
            ORDER BY p.created_at DESC
        `);
        return rows.map(row => {
            const images = safeParse(row.images, []);
            const details = safeParse(row.details, {});
            return {
                id: row.id.toString(),
                name: row.name,
                description: row.description,
                image: images[0] || 'https://placehold.co/300x300.png',
                images: images,
                sellingPrice: parseFloat(row.selling_price),
                currency: 'USD',
                stock: Number(row.stock),
                barcode: row.barcode,
                isbn10: details.isbn10,
                isbn13: details.isbn13,
                variations: safeParse(row.variations, []),
                promotionalPackages: safeParse(row.promotional_packages, null),
                weight: parseFloat(row.weight || 0),
                shippingRates: safeParse(row.shipping_rates, []),
                categoryId: row.category_id,
                boutiqueId: row.boutique_id?.toString() || '',
                boutiqueName: row.boutiqueName,
                isPublic: Boolean(row.is_public),
                countryCode: row.countryCode,
                sellerWalletId: row.sellerWalletId,
                seller: { id: row.sellerId.toString(), name: row.sellerName },
                createdAt: new Date(row.created_at || Date.now()).toISOString(),
                sellerSubscriptionStatus: row.sellerSubscriptionStatus,
                details
            }
        }) as Product[];
    } catch (error) {
        await handleDbError(error, 'fetching public products');
        return [];
    }
}

export async function getProductById(id: string): Promise<Product | undefined> {
    try {
        const { rows } = await db.query(`
            SELECT 
                p.*,
                b.name as "boutiqueName",
                u.id_wallet as "sellerWalletId",
                u.id as "sellerId",
                u.full_name as "sellerName",
                u.country as "countryCode",
                CASE WHEN subs.status = 'active' AND subs.current_period_end > NOW() THEN 'active' ELSE 'inactive' END as "sellerSubscriptionStatus"
            FROM products p
            LEFT JOIN boutiques b ON p.boutique_id = b.id
            LEFT JOIN users u ON p.agent_id = u.id
            LEFT JOIN agent_subscriptions subs ON u.id = subs.user_id
            WHERE p.id = $1
        `, [id]);

        if (rows.length === 0) return undefined;

        const row = rows[0];
        const images = safeParse(row.images, []);
        const details = safeParse(row.details, {});
        
        return {
            id: row.id.toString(),
            name: row.name,
            description: row.description,
            details,
            image: images[0] || 'https://placehold.co/300x300.png',
            images: images,
            sellingPrice: parseFloat(row.selling_price),
            currency: 'USD',
            stock: Number(row.stock),
            barcode: row.barcode,
            isbn10: details.isbn10,
            isbn13: details.isbn13,
            variations: safeParse(row.variations, []),
            promotionalPackages: safeParse(row.promotional_packages, null),
            weight: parseFloat(row.weight || 0),
            shippingRates: safeParse(row.shipping_rates, []),
            seller: { id: row.sellerId.toString(), name: row.sellerName },
            sellerWalletId: row.sellerWalletId,
            boutiqueName: row.boutiqueName,
            isPublic: Boolean(row.is_public),
            countryCode: row.countryCode,
            categoryId: row.category_id,
            boutiqueId: row.boutique_id?.toString() || '',
            sellerSubscriptionStatus: row.sellerSubscriptionStatus
        } as Product;
    } catch (error) {
        return undefined;
    }
}

interface CreateOrderArgs {
    user: User;
    items: CartItem[];
    totalPrice: number;
    currency: string;
    pin: string;
    shippingCost: number;
    vatAmount: number;
    shippingAddressId?: string;
}

export async function createOrder(args: CreateOrderArgs): Promise<{ success: boolean; error?: string; order?: Order }> {
    const { user, items, totalPrice, currency, pin, shippingCost, vatAmount, shippingAddressId } = args;
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const pinResult = await verifyCurrentUserPin(pin);
        if (!pinResult.success) throw new Error(pinResult.error || "PIN incorrect.");
        
        const firstItemSellerId = items[0]?.seller ? parseInt(items[0].seller.id, 10) : undefined;
        if (firstItemSellerId === undefined) throw new Error("Vendeur introuvable.");
        
        const tx = await createTransaction({
            user, typeCode: 'POS_SALE', amount: totalPrice, currency,
            description: `Achat JoJo Market (${items.length} articles)`,
            metadata: { 
                items: items.map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: currentPrice(item, item.quantity),
                    isDigital: item.categoryId === 'cat-livre'
                })), 
                shipping_cost: shippingCost, 
                vat_amount: vatAmount 
            },
            receiver_id: firstItemSellerId,
            connection
        });

        if (!tx.success || !tx.transactionId) throw new Error(tx.error || "Échec de la transaction financière.");
        
        const orderRef = generateReferenceCode('ORDER');
        const isOnlyDigital = items.every(i => i.categoryId === 'cat-livre');
        const initialStatus = isOnlyDigital ? 'delivered' : 'paid';

        const { rows: orderRows } = await connection.query(`
            INSERT INTO orders (user_id, total_amount, status, transaction_id, reference, shipping_cost, vat_amount, shipping_address_id, currency) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `, [user.id, totalPrice, initialStatus, tx.transactionId, orderRef, shippingCost, vatAmount, shippingAddressId ? parseInt(shippingAddressId, 10) : null, currency]);
        const orderId = orderRows[0].id;

        for (const item of items) {
            const productIdInt = parseInt(item.id, 10);
            
            await connection.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)', 
                [orderId, productIdInt, item.quantity, currentPrice(item, item.quantity)]);
            
            const { rows: prodRows } = await connection.query('SELECT variations, stock, name FROM products WHERE id = $1 FOR UPDATE', [productIdInt]);
            if (prodRows.length > 0) {
                const prod = prodRows[0];
                const availableStock = Number(prod.stock || 0);

                if (availableStock < item.quantity) {
                    throw new Error(`Stock insuffisant pour ${prod.name}.`);
                }

                const vars: ProductVariation[] = safeParse(prod.variations, []);
                
                // Mise à jour robuste du stock
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

                await connection.query('UPDATE products SET variations = $1, stock = stock - $2 WHERE id = $3', 
                    [JSON.stringify(vars), item.quantity, productIdInt]);
            }
        }
        
        const { rows: cartRows } = await connection.query('SELECT id FROM shopping_carts WHERE user_id = $1', [user.id]);
        if (cartRows.length > 0) {
            await connection.query('DELETE FROM shopping_cart_items WHERE cart_id = $1 AND product_id = ANY($2::int[])', 
                [cartRows[0].id, items.map(i => parseInt(i.id, 10))]);
        }

        await connection.query('COMMIT');
        
        const order: Order = {
            id: orderId.toString(), reference: orderRef, userId: user.id, totalPrice, currency,
            status: initialStatus, createdAt: new Date().toISOString(), productName: items[0].name, quantity: items.length
        };
        
        try { 
            processMlmOrder(order).catch(err => console.error("MLM Processing (Silent):", err)); 
        } catch(e) {}

        if (user.email) {
            sendEmail(user.email, 'Confirmation de commande', 'general', {
                title: isOnlyDigital ? 'Vos fichiers sont prêts !' : 'Merci pour votre commande !',
                greeting: `Bonjour ${user.first_name},`,
                message: isOnlyDigital 
                    ? `Votre commande digitale #${orderRef} a été traitée. Vous pouvez télécharger vos livres dans votre espace client.`
                    : `Votre commande #${orderRef} a été payée avec succès.`,
                buttonText: isOnlyDigital ? 'Télécharger mes livres' : 'Mes commandes',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/shopping/orders`,
                signature: "L'équipe JoJo Shopping"
            }).catch(console.error);
        }

        return { success: true, order };
    } catch (e: any) {
        if (connection) await connection.query('ROLLBACK');
        console.error("Order Creation Error:", e);
        return { success: false, error: e.message };
    } finally { 
        if (connection) connection.release(); 
    }
}

export async function getOrdersForUser(userId: number): Promise<Order[]> {
    try {
        const { rows: orderRows } = await db.query(`
            SELECT 
                o.id, o.reference, o.user_id as "userId", o.total_amount as "totalPrice", o.status, o.created_at as "createdAt",
                t.currency
            FROM orders o
            JOIN transactions t ON o.transaction_id = t.id
            WHERE o.user_id = $1
            ORDER BY o.created_at DESC
        `, [userId]);

        const orders: Order[] = [];
        for (const row of orderRows) {
            const { rows: itemRows } = await db.query(`
                SELECT p.id, p.name, p.images, p.details, u.full_name as "sellerName", u.id as "sellerId", oi.quantity, p.category_id
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                JOIN users u ON p.agent_id = u.id
                WHERE oi.order_id = $1 LIMIT 1
            `, [row.id]);

            if (itemRows.length > 0) {
                const images = safeParse(itemRows[0].images, []);
                const details = safeParse(itemRows[0].details, {});
                orders.push({
                    id: row.id.toString(), reference: row.reference, userId, 
                    totalPrice: parseFloat(row.totalPrice || 0), currency: row.currency,
                    status: row.status, createdAt: new Date(row.createdAt).toISOString(),
                    productName: itemRows[0].name, productImage: images[0] || 'https://placehold.co/120x120.png',
                    quantity: itemRows[0].quantity, seller: { id: itemRows[0].sellerId.toString(), name: itemRows[0].sellerName },
                    metadata: {
                        isDigital: itemRows[0].category_id === 'cat-livre',
                        pdfUrl: details?.pdfUrl,
                        audioUrl: details?.audioUrl
                    }
                });
            }
        }
        return orders;
    } catch (error) {
        console.error("getOrdersForUser error:", error);
        return [];
    }
}

export async function confirmOrderReception(orderId: string): Promise<{ success: boolean; error?: string; order?: Order }> {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return { success: false, error: "Non autorisé." };

        const { rows: orderCheck } = await db.query('SELECT id, status FROM orders WHERE (id::text = $1 OR reference = $1) AND user_id = $2', [orderId, user.id]);
        
        if (orderCheck.length === 0) return { success: false, error: "Commande introuvable." };
        
        const actualId = orderCheck[0].id;
        await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['delivered', actualId]);
        
        return { success: true };
    } catch (error) {
        return { success: false, error: "Une erreur est survenue." };
    }
}

export async function getUserWishlist(userId: number): Promise<Product[]> {
    try {
        const { rows } = await db.query(`
            SELECT p.*, b.name as "boutiqueName", u.full_name as "sellerName", u.id as "sellerId"
            FROM wishlist_items wi
            JOIN wishlists w ON wi.wishlist_id = w.id
            JOIN products p ON wi.product_id = p.id
            LEFT JOIN boutiques b ON p.boutique_id = b.id
            JOIN users u ON p.agent_id = u.id
            WHERE w.user_id = $1
        `, [userId]);

        return rows.map(row => {
            const images = safeParse(row.images, []);
            const details = safeParse(row.details, {});
            return {
                id: row.id.toString(),
                name: row.name,
                description: row.description,
                image: images[0] || 'https://placehold.co/300x300.png',
                images: images,
                sellingPrice: parseFloat(row.selling_price),
                currency: 'USD',
                stock: Number(row.stock),
                barcode: row.barcode,
                isbn10: details.isbn10,
                isbn13: details.isbn13,
                variations: safeParse(row.variations, []),
                promotionalPackages: safeParse(row.promotional_packages, null),
                weight: parseFloat(row.weight || 0),
                shippingRates: safeParse(row.shipping_rates, []),
                seller: { id: row.sellerId.toString(), name: row.sellerName },
                boutiqueName: row.boutiqueName,
                isPublic: Boolean(row.is_public),
                categoryId: row.category_id,
                boutiqueId: row.boutique_id?.toString() || '',
                details
            }
        });
    } catch (error) {
        return [];
    }
}

export async function getUserCart(userId: number): Promise<CartItem[]> {
    try {
        const { rows } = await db.query(`
            SELECT p.*, sci.quantity, u.full_name as "sellerName", u.id_wallet as "sellerWalletId"
            FROM shopping_cart_items sci
            JOIN products p ON sci.product_id = p.id
            JOIN shopping_carts sc ON sci.cart_id = sc.id
            JOIN users u ON p.agent_id = u.id
            WHERE sc.user_id = $1
        `, [userId]);
        return rows.map(row => {
            const details = safeParse(row.details, {});
            return {
                id: row.id.toString(), name: row.name, image: safeParse(row.images, [])[0],
                sellingPrice: parseFloat(row.selling_price), currency: 'USD',
                quantity: row.quantity, seller: { id: row.agent_id.toString(), name: row.sellerName },
                sellerWalletId: row.sellerWalletId, variations: safeParse(row.variations, []),
                promotionalPackages: safeParse(row.promotional_packages, null),
                weight: parseFloat(row.weight || 0), shippingRates: safeParse(row.shipping_rates, []),
                barcode: row.barcode,
                isbn10: details.isbn10,
                isbn13: details.isbn13,
                categoryId: row.category_id,
                boutiqueId: row.boutique_id.toString(),
                isPublic: Boolean(row.is_public),
                details
            } as CartItem;
        });
    } catch (error) { return []; }
}

export async function updateUserCart(userId: number, productId: string, quantity: number): Promise<{ success: boolean; cart?: CartItem[] }> {
    try {
        const { rows: cartRows } = await db.query('INSERT INTO shopping_carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING RETURNING id', [userId]);
        let cartId;
        if (cartRows.length === 0) {
            const existingCart = await db.query('SELECT id FROM shopping_carts WHERE user_id = $1', [userId]);
            cartId = existingCart.rows[0].id;
        } else {
            cartId = cartRows[0].id;
        }

        if (quantity <= 0) {
            await db.query('DELETE FROM shopping_cart_items WHERE cart_id = $1 AND product_id = $2', [cartId, productId]);
        } else {
            await db.query('INSERT INTO shopping_cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity', [cartId, productId, quantity]);
        }
        return { success: true, cart: await getUserCart(userId) };
    } catch (error) { return { success: false }; }
}

/**
 * Ajoute ou retire un produit de la liste de souhaits de l'utilisateur.
 */
export async function toggleUserWishlistItem(userId: number, productId: string): Promise<{ success: boolean; isFavorite: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const productIdInt = parseInt(productId, 10);
        
        // 1. S'assurer que la liste de souhaits existe
        const { rows: wishlistRows } = await connection.query(`
            INSERT INTO wishlists (user_id) VALUES ($1) 
            ON CONFLICT (user_id) DO NOTHING 
            RETURNING id
        `, [userId]);
        
        let wishlistId;
        if (wishlistRows.length === 0) {
            const existing = await connection.query('SELECT id FROM wishlists WHERE user_id = $1', [userId]);
            wishlistId = existing.rows[0].id;
        } else {
            wishlistId = wishlistRows[0].id;
        }

        // 2. Vérifier si l'article est déjà présent
        const { rows: exists } = await connection.query(`
            SELECT 1 FROM wishlist_items 
            WHERE wishlist_id = $1 AND product_id = $2
        `, [wishlistId, productIdInt]);
        
        let isFavorite = false;
        if (exists.length > 0) {
            await connection.query('DELETE FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2', [wishlistId, productIdInt]);
            isFavorite = false;
        } else {
            await connection.query('INSERT INTO wishlist_items (wishlist_id, product_id) VALUES ($1, $2)', [wishlistId, productIdInt]);
            isFavorite = true;
        }

        await connection.query('COMMIT');
        return { success: true, isFavorite };
    } catch (e: any) { 
        if (connection) await connection.query('ROLLBACK');
        console.error("Wishlist toggle error:", e);
        return { success: false, error: "Impossible de modifier vos favoris.", isFavorite: false }; 
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Récupère les infos d'abonnement et de followers d'une boutique/vendeur.
 * Lie le vendeur à sa compagnie MonPays.
 */
export async function getStoreFollowerInfo(userId: number | undefined, sellerId: number) {
    try {
        // Trouver la compagnie associée à ce vendeur (agent_id = owner_user_id)
        const { rows: companyRows } = await db.query('SELECT id FROM monpays_companies WHERE owner_user_id = $1 LIMIT 1', [sellerId]);
        if (companyRows.length === 0) return { followerCount: 0, isFollowing: false };
        
        const companyId = companyRows[0].id;

        const { rows: count } = await db.query('SELECT COUNT(*) FROM company_followers WHERE company_id = $1', [companyId]);
        let isFollowing = false;
        if (userId) {
            const { rows = [] } = await db.query('SELECT 1 FROM company_followers WHERE user_id = $1 AND company_id = $2', [userId, companyId]);
            isFollowing = rows.length > 0;
        }
        return { followerCount: parseInt(count[0].count), isFollowing };
    } catch (e) { return { followerCount: 0, isFollowing: false }; }
}

/**
 * Alterne le statut d'abonnement à une boutique.
 */
export async function toggleFollowStore(userId: number, sellerId: number) {
    try {
        const { rows: companyRows } = await db.query('SELECT id FROM monpays_companies WHERE owner_user_id = $1 LIMIT 1', [sellerId]);
        if (companyRows.length === 0) throw new Error("Boutique non enregistrée sur MonPays.");
        
        const companyId = companyRows[0].id;

        const { rows: exists } = await db.query('SELECT 1 FROM company_followers WHERE user_id = $1 AND company_id = $2', [userId, companyId]);
        if (exists.length > 0) {
            await db.query('DELETE FROM company_followers WHERE user_id = $1 AND company_id = $2', [userId, companyId]);
            return { success: true, isFollowing: false };
        } else {
            await db.query('INSERT INTO company_followers (user_id, company_id) VALUES ($1, $2)', [userId, companyId]);
            return { success: true, isFollowing: true };
        }
    } catch (e) { return { success: false, error: "Erreur lors du suivi de la boutique." }; }
}

export async function getSellerInfo(sellerId: string): Promise<User | null> {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [parseInt(sellerId, 10)]);
        if (rows.length === 0) return null;
        return formatUser(rows[0]);
    } catch (error) { return null; }
}

export async function getFollowedStores(userId: number): Promise<any[]> {
    try {
        const { rows } = await db.query(`
            SELECT u.id, u.full_name as name
            FROM company_followers cf
            JOIN monpays_companies mc ON cf.company_id = mc.id
            JOIN users u ON mc.owner_user_id = u.id
            WHERE cf.user_id = $1
        `, [userId]);
        return rows;
    } catch (error) { return []; }
}
