
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
                COALESCE((SELECT COUNT(DISTINCT o.id) FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE oi.product_id = p.id AND o.status = $$delivered$$), 0) as "orderCount",
                COALESCE((SELECT COUNT(*) FROM product_comments pc WHERE pc.product_id = p.id), 0) as "commentCount",
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
            viewCount: Number(row.view_count || 0),
            orderCount: Number(row.orderCount || 0),
            commentCount: Number(row.commentCount || 0),
            reviewCount: Number(row.review_count || 0),
            ratingAverage: Number(row.rating_average || 0),
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
                COALESCE((SELECT COUNT(DISTINCT o.id) FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE oi.product_id = p.id AND o.status = $$delivered$$), 0) as "orderCount",
                COALESCE((SELECT COUNT(*) FROM product_comments pc WHERE pc.product_id = p.id), 0) as "commentCount",
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
            sellerSubscriptionStatus: row.sellerSubscriptionStatus,
            viewCount: Number(row.view_count || 0),
            orderCount: Number(row.orderCount || 0),
            commentCount: Number(row.commentCount || 0),
            reviewCount: Number(row.review_count || 0),
            ratingAverage: Number(row.rating_average || 0),
        } as Product;
    } catch (error) {
        return undefined;
    }
}
export async function recordProductView(productId: string): Promise<void> {
    try {
        await db.query(
            `UPDATE products SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
            [productId]
        );
    } catch (error) {
        handleDbError(error, 'recording product view');
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

function calculateBackendUnitPrice(
    sellingPrice: number,
    promotionalPackages: any,
    quantity: number
): number {
    const basePrice = Number(sellingPrice);

    if (!Number.isFinite(basePrice) || basePrice < 0) {
        throw new Error("Prix du produit invalide.");
    }

    const packages = Array.isArray(promotionalPackages)
        ? promotionalPackages
        : [];

    let effectivePrice = basePrice;
    let bestThreshold = 0;

    for (const pkg of packages) {
        const threshold = Number(
            pkg?.quantity ??
            pkg?.minQuantity ??
            pkg?.min_quantity
        );

        const promoPrice = Number(pkg?.price);

        // quantity is the format currently saved by the seller form.
        // Old minQuantity formats remain supported for compatibility.
        if (
            !Number.isInteger(threshold) ||
            threshold <= 0 ||
            !Number.isFinite(promoPrice) ||
            promoPrice < 0
        ) {
            continue;
        }

        if (quantity >= threshold && threshold > bestThreshold) {
            effectivePrice = promoPrice;
            bestThreshold = threshold;
        }
    }

    return Math.round(effectivePrice * 100) / 100;
}

function normalizeShippingValue(value: any): string {
    return String(value ?? "").trim().toLowerCase();
}

function calculateBackendShipping(
    products: any[],
    shippingAddress: { province: string; countryCode: string } | null
): number {
    if (!shippingAddress) {
        return 0;
    }

    const addressCountry = normalizeShippingValue(shippingAddress.countryCode);
    const addressProvince = normalizeShippingValue(shippingAddress.province);

    let shippingTotal = 0;

    for (const product of products) {
        // Digital books do not require physical delivery.
        if (product.category_id === "cat-livre") {
            continue;
        }

        const weight = Number(product.weight || 0);
        const quantity = Number(product.quantity || 0);

        if (!Number.isFinite(weight) || weight < 0) {
            throw new Error(`Poids invalide pour ${product.name}.`);
        }

        const rates = Array.isArray(product.shipping_rates)
            ? product.shipping_rates
            : [];

        const matchingRate = rates.find((rate: any) => {
            const rateCountry = normalizeShippingValue(rate?.country);
            const rateProvince = normalizeShippingValue(rate?.province);

            return (
                rateCountry === addressCountry &&
                rateProvince === addressProvince
            );
        }) || rates.find((rate: any) => {
            const rateCountry = normalizeShippingValue(rate?.country);
            const rateProvince = normalizeShippingValue(rate?.province);

            return (
                rateCountry === addressCountry &&
                rateProvince === ""
            );
        });

        if (!matchingRate) {
            throw new Error(
                `Aucun tarif de livraison configuré pour ${product.name} vers cette destination.`
            );
        }

        const rate = Number(matchingRate.rate);

        if (!Number.isFinite(rate) || rate < 0) {
            throw new Error(
                `Tarif de livraison invalide pour ${product.name}.`
            );
        }

        shippingTotal += weight * quantity * rate;
    }

    return Math.round(shippingTotal * 100) / 100;
}

export async function createOrder(
    args: CreateOrderArgs
): Promise<{ success: boolean; error?: string; order?: Order }> {
    const {
        user,
        items,
        pin,
        shippingAddressId
    } = args;

    const connection = await db.getConnection();

    try {
        if (!items || items.length === 0) {
            throw new Error("Votre panier est vide.");
        }

        const authenticatedUser = await getAuthenticatedUser();

        if (!authenticatedUser || authenticatedUser.id !== user.id) {
            throw new Error("Session utilisateur invalide.");
        }

        const pinResult = await verifyCurrentUserPin(pin);

        if (!pinResult.success) {
            throw new Error(pinResult.error || "PIN incorrect.");
        }

        // Validate item IDs and quantities before touching financial data.
        const productIds: number[] = [];
        const seenProductIds = new Set<number>();

        for (const item of items) {
            const productId = Number.parseInt(String(item.id), 10);
            const quantity = Number(item.quantity);

            if (!Number.isInteger(productId) || productId <= 0) {
                throw new Error("Produit invalide dans le panier.");
            }

            if (!Number.isInteger(quantity) || quantity <= 0) {
                throw new Error(`Quantité invalide pour ${item.name}.`);
            }

            if (seenProductIds.has(productId)) {
                throw new Error(`Produit dupliqué dans le panier : ${item.name}.`);
            }

            seenProductIds.add(productId);
            productIds.push(productId);
        }

        await connection.query("BEGIN");

        /*
         * The order must correspond to the user's actual cart.
         * This prevents a client from submitting arbitrary products or
         * arbitrary quantities directly to createOrder().
         */
        const { rows: cartRows } = await connection.query(
            `
            SELECT
                sci.product_id,
                sci.quantity
            FROM shopping_cart_items sci
            JOIN shopping_carts sc
                ON sc.id = sci.cart_id
            WHERE sc.user_id = $1
              AND sci.product_id = ANY($2::int[])
            `,
            [authenticatedUser.id, productIds]
        );

        const cartQuantityByProduct = new Map<number, number>();

        for (const row of cartRows) {
            cartQuantityByProduct.set(
                Number(row.product_id),
                Number(row.quantity)
            );
        }

        for (const item of items) {
            const productId = Number.parseInt(String(item.id), 10);
            const cartQuantity = cartQuantityByProduct.get(productId);

            if (cartQuantity === undefined) {
                throw new Error(
                    `Le produit ${item.name} n'est plus présent dans votre panier.`
                );
            }

            if (cartQuantity !== Number(item.quantity)) {
                throw new Error(
                    `La quantité de ${item.name} a changé. Veuillez actualiser votre panier.`
                );
            }
        }

        /*
         * Lock and read the real product data from PostgreSQL.
         * Nothing used for the financial calculation comes from the client.
         */
        const products: any[] = [];

        for (const item of items) {
            const productId = Number.parseInt(String(item.id), 10);

            const { rows: prodRows } = await connection.query(
                `
                SELECT
                    id,
                    agent_id,
                    name,
                    selling_price,
                    currency,
                    stock,
                    weight,
                    shipping_rates,
                    promotional_packages,
                    variations,
                    category_id
                FROM products
                WHERE id = $1
                FOR UPDATE
                `,
                [productId]
            );

            if (prodRows.length === 0) {
                throw new Error(`Produit introuvable : ${item.name}.`);
            }

            const product = prodRows[0];
            const quantity = Number(item.quantity);
            const availableStock = Number(product.stock || 0);

            if (!Number.isInteger(availableStock) || availableStock < 0) {
                throw new Error(`Stock invalide pour ${product.name}.`);
            }

            if (availableStock < quantity) {
                throw new Error(
                    `Stock insuffisant pour ${product.name}. Disponible : ${availableStock}.`
                );
            }

            const unitPrice = calculateBackendUnitPrice(
                Number(product.selling_price),
                safeParse(product.promotional_packages, []),
                quantity
            );

            products.push({
                ...product,
                quantity,
                unitPrice,
                promotional_packages: safeParse(
                    product.promotional_packages,
                    []
                ),
                shipping_rates: safeParse(
                    product.shipping_rates,
                    []
                ),
                variations: safeParse(
                    product.variations,
                    []
                )
            });
        }

        /*
         * All selected products must use the same currency.
         * The currency is taken from PostgreSQL, never from the client.
         */
        const currencies = [
            ...new Set(
                products.map(
                    product =>
                        String(product.currency || "USD").trim().toUpperCase()
                )
            )
        ];

        if (currencies.length !== 1) {
            throw new Error(
                "Les produits sélectionnés utilisent des devises différentes."
            );
        }

        const orderCurrency = currencies[0];

        /*
         * Calculate the real product subtotal from database prices.
         */
        const subtotal = Math.round(
            products.reduce(
                (sum, product) =>
                    sum +
                    Number(product.unitPrice) * Number(product.quantity),
                0
            ) * 100
        ) / 100;

        /*
         * Delivery is determined by the presence of an address.
         * Pickup sends no shippingAddressId and therefore costs 0.
         */
        let shippingAddress: {
            province: string;
            countryCode: string;
        } | null = null;

        if (shippingAddressId) {
            const addressId = Number.parseInt(
                String(shippingAddressId),
                10
            );

            if (!Number.isInteger(addressId) || addressId <= 0) {
                throw new Error("Adresse de livraison invalide.");
            }

            const { rows: addressRows } = await connection.query(
                `
                SELECT
                    province,
                    country_code
                FROM user_addresses
                WHERE id = $1
                  AND user_id = $2
                LIMIT 1
                `,
                [addressId, authenticatedUser.id]
            );

            if (addressRows.length === 0) {
                throw new Error(
                    "Adresse de livraison introuvable ou non autorisée."
                );
            }

            shippingAddress = {
                province: String(addressRows[0].province || ""),
                countryCode: String(
                    addressRows[0].country_code || ""
                )
            };

            if (
                !shippingAddress.province.trim() ||
                !shippingAddress.countryCode.trim()
            ) {
                throw new Error(
                    "L'adresse de livraison ne contient pas une destination valide."
                );
            }
        }

        const shippingTotal = calculateBackendShipping(
            products,
            shippingAddress
        );

        /*
         * VAT is also calculated from the server-calculated subtotal
         * and shipping amount, never from client-supplied totals.
         */
        const amountForVat = Math.round(
            (subtotal + shippingTotal) * 100
        ) / 100;

        const vatAmountServer = await calculateTransactionFee(
            amountForVat,
            orderCurrency,
            "PRODUCT_SALE_VAT",
            authenticatedUser.country
        );

        const serverVatAmount = Math.round(
            Number(vatAmountServer || 0) * 100
        ) / 100;

        const finalTotal = Math.round(
            (subtotal + shippingTotal + serverVatAmount) * 100
        ) / 100;

        if (!Number.isFinite(finalTotal) || finalTotal <= 0) {
            throw new Error("Montant final de commande invalide.");
        }

        const firstItemSellerId = Number(products[0]?.agent_id);

        if (
            !Number.isInteger(firstItemSellerId) ||
            firstItemSellerId <= 0
        ) {
            throw new Error("Vendeur introuvable.");
        }

        /*
         * The financial transaction now uses only server-calculated values.
         */
        const tx = await createTransaction({
            user: authenticatedUser,
            typeCode: "POS_SALE",
            amount: finalTotal,
            currency: orderCurrency,
            description: `Achat JoJo Market (${items.length} articles)`,
            metadata: {
                items: products.map(product => ({
                    id: Number(product.id),
                    name: product.name,
                    quantity: Number(product.quantity),
                    price: Number(product.unitPrice),
                    isDigital: product.category_id === "cat-livre"
                })),
                subtotal,
                shipping_cost: shippingTotal,
                vat_amount: serverVatAmount,
                total: finalTotal,
                shipping_address_id: shippingAddressId
                    ? Number.parseInt(String(shippingAddressId), 10)
                    : null
            },
            receiver_id: firstItemSellerId,
            connection
        });

        if (!tx.success || !tx.transactionId) {
            throw new Error(
                tx.error || "Échec de la transaction financière."
            );
        }

        const orderRef = generateReferenceCode("ORDER");
        const isOnlyDigital = products.every(
            product => product.category_id === "cat-livre"
        );
        const initialStatus = isOnlyDigital
            ? "delivered"
            : "paid";

        const { rows: orderRows } = await connection.query(
            `
            INSERT INTO orders
                (
                    user_id,
                    total_amount,
                    status,
                    transaction_id,
                    reference,
                    shipping_cost,
                    vat_amount,
                    shipping_address_id,
                    currency
                )
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
            `,
            [
                authenticatedUser.id,
                finalTotal,
                initialStatus,
                tx.transactionId,
                orderRef,
                shippingTotal,
                serverVatAmount,
                shippingAddressId
                    ? Number.parseInt(String(shippingAddressId), 10)
                    : null,
                orderCurrency
            ]
        );

        const orderId = orderRows[0].id;

        /*
         * Insert order lines using the server-calculated promotional price.
         */
        for (const product of products) {
            await connection.query(
                `
                INSERT INTO order_items
                    (order_id, product_id, quantity, unit_price)
                VALUES
                    ($1, $2, $3, $4)
                `,
                [
                    orderId,
                    Number(product.id),
                    Number(product.quantity),
                    Number(product.unitPrice)
                ]
            );

            const vars: ProductVariation[] = Array.isArray(
                product.variations
            )
                ? product.variations
                : [];

            if (vars.length > 0) {
                let qtyToDeduct = Number(product.quantity);

                for (const v of vars) {
                    if (qtyToDeduct <= 0) break;

                    const variationStock = Number(v.stock || 0);

                    if (variationStock > 0) {
                        const toDeduct = Math.min(
                            qtyToDeduct,
                            variationStock
                        );

                        v.stock = variationStock - toDeduct;
                        qtyToDeduct -= toDeduct;
                    }
                }
            }

            await connection.query(
                `
                UPDATE products
                SET
                    variations = $1,
                    stock = stock - $2
                WHERE id = $3
                `,
                [
                    JSON.stringify(vars),
                    Number(product.quantity),
                    Number(product.id)
                ]
            );
        }

        /*
         * Remove exactly the purchased products from the user's cart.
         */
        const { rows: cartRowsAfterOrder } = await connection.query(
            `
            SELECT id
            FROM shopping_carts
            WHERE user_id = $1
            LIMIT 1
            `,
            [authenticatedUser.id]
        );

        if (cartRowsAfterOrder.length > 0) {
            await connection.query(
                `
                DELETE FROM shopping_cart_items
                WHERE cart_id = $1
                  AND product_id = ANY($2::int[])
                `,
                [
                    cartRowsAfterOrder[0].id,
                    productIds
                ]
            );
        }

        await connection.query("COMMIT");

        /*
         * Return the normal order result. Client-provided totalPrice,
         * shippingCost and vatAmount were intentionally not trusted.
         */
        return {
            success: true,
            order: {
                id: orderId,
                userId: authenticatedUser.id,
                totalAmount: finalTotal,
                status: initialStatus,
                transactionId: tx.transactionId,
                reference: orderRef,
                shippingCost: shippingTotal,
                vatAmount: serverVatAmount,
                shippingAddressId: shippingAddressId
                    ? Number.parseInt(String(shippingAddressId), 10)
                    : undefined,
                currency: orderCurrency
            } as Order
        };

    } catch (error: any) {
        try {
            await connection.query("ROLLBACK");
        } catch {}

        console.error("createOrder error:", error);

        return {
            success: false,
            error:
                error?.message ||
                "Impossible de créer la commande."
        };
    } finally {
        connection.release();
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

        const { rows: orderCheck } = await db.query(
            'SELECT id, status FROM orders WHERE (id::text = $1 OR reference = $1) AND user_id = $2',
            [orderId, user.id]
        );

        if (orderCheck.length === 0) return { success: false, error: "Commande introuvable." };

        const actualId = orderCheck[0].id;
        await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['delivered', actualId]);

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
        `, [actualId]);

        return { success: true };
    } catch (error) {
        return { success: false, error: "Une erreur est survenue." };
    }
}

export async function getUserWishlist(userId: number): Promise<Product[]> {
    try {
        const { rows } = await db.query(`
            SELECT p.*, b.name as "boutiqueName", u.full_name as "sellerName", u.id as "sellerId"
                COALESCE((SELECT COUNT(DISTINCT o.id) FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE oi.product_id = p.id AND o.status = $$delivered$$), 0) as "orderCount",
                COALESCE((SELECT COUNT(*) FROM product_comments pc WHERE pc.product_id = p.id), 0) as "commentCount",
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
        // Une boutique Shopping appartient directement à l'agent/vendeur.
        const { rows: boutiqueRows } = await db.query(
            'SELECT id FROM boutiques WHERE agent_id = $1 ORDER BY id ASC LIMIT 1',
            [sellerId]
        );

        if (boutiqueRows.length === 0) {
            return { followerCount: 0, isFollowing: false };
        }

        const boutiqueId = boutiqueRows[0].id;

        const { rows: count } = await db.query(
            'SELECT COUNT(*) FROM boutique_followers WHERE boutique_id = $1',
            [boutiqueId]
        );

        let isFollowing = false;

        if (userId) {
            const { rows = [] } = await db.query(
                'SELECT 1 FROM boutique_followers WHERE user_id = $1 AND boutique_id = $2',
                [userId, boutiqueId]
            );
            isFollowing = rows.length > 0;
        }

        return {
            followerCount: parseInt(count[0].count, 10),
            isFollowing
        };
    } catch (e) {
        console.error("getStoreFollowerInfo error:", e);
        return { followerCount: 0, isFollowing: false };
    }
}

/**
 * Alterne le statut d'abonnement à une boutique Shopping.
 * Utilise exclusivement boutique_followers et boutiques.
 */
export async function toggleFollowStore(userId: number, sellerId: number) {
    try {
        const { rows: boutiqueRows } = await db.query(
            'SELECT id FROM boutiques WHERE agent_id = $1 ORDER BY id ASC LIMIT 1',
            [sellerId]
        );

        if (boutiqueRows.length === 0) {
            throw new Error("Boutique introuvable.");
        }

        const boutiqueId = boutiqueRows[0].id;

        const { rows: exists } = await db.query(
            'SELECT 1 FROM boutique_followers WHERE user_id = $1 AND boutique_id = $2',
            [userId, boutiqueId]
        );

        if (exists.length > 0) {
            await db.query(
                'DELETE FROM boutique_followers WHERE user_id = $1 AND boutique_id = $2',
                [userId, boutiqueId]
            );

            await db.query(
                `UPDATE boutiques
                 SET follower_count = (
                     SELECT COUNT(*)
                     FROM boutique_followers
                     WHERE boutique_id = $1
                 ),
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [boutiqueId]
            );

            return { success: true, isFollowing: false };
        }

        await db.query(
            `INSERT INTO boutique_followers (user_id, boutique_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, boutique_id) DO NOTHING`,
            [userId, boutiqueId]
        );

        await db.query(
            `UPDATE boutiques
             SET follower_count = (
                 SELECT COUNT(*)
                 FROM boutique_followers
                 WHERE boutique_id = $1
             ),
             updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [boutiqueId]
        );

        return { success: true, isFollowing: true };
    } catch (e) {
        console.error("toggleFollowStore error:", e);
        return { success: false, error: "Erreur lors du suivi de la boutique." };
    }
}

export async function getSellerInfo(sellerId: string): Promise<User | null> {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [parseInt(sellerId, 10)]);
        if (rows.length === 0) return null;
        return formatUser(rows[0]);
    } catch (error) { return null; }
}


export async function getPublicBoutiqueContact(
    boutiqueId: string,
    sellerId: string
): Promise<{
    id: string;
    name: string;
    whatsapp_public_number: string | null;
} | null> {
    try {
        const parsedBoutiqueId = parseInt(boutiqueId, 10);
        const parsedSellerId = parseInt(sellerId, 10);

        if (!Number.isFinite(parsedBoutiqueId) || !Number.isFinite(parsedSellerId)) {
            return null;
        }

        const { rows } = await db.query(
            `SELECT
                b.id,
                b.name,
                b.whatsapp_public_number
             FROM boutiques b
             WHERE b.id = $1
               AND b.agent_id = $2
             LIMIT 1`,
            [parsedBoutiqueId, parsedSellerId]
        );

        if (!rows.length) {
            return null;
        }

        return {
            id: rows[0].id.toString(),
            name: rows[0].name,
            whatsapp_public_number: rows[0].whatsapp_public_number || null,
        };
    } catch (error) {
        console.error('getPublicBoutiqueContact error:', error);
        return null;
    }
}

export async function getFollowedStores(userId: number): Promise<any[]> {
    try {
        const { rows } = await db.query(`
            SELECT
                b.id,
                b.name,
                b.agent_id as "sellerId"
            FROM boutique_followers bf
            JOIN boutiques b ON bf.boutique_id = b.id
            WHERE bf.user_id = $1
            ORDER BY bf.created_at DESC
        `, [userId]);

        return rows;
    } catch (error) {
        console.error("getFollowedStores error:", error);
        return [];
    }
}
