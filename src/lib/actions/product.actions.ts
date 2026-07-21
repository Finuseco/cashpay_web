
'use server';

import type { Product } from '@/lib/types';
import { db } from '@/lib/db';
import { handleDbError } from './helpers';

// Helper to safely parse JSON or return the value if already parsed
const safeParse = (val: any, fallback: any) => {
    if (val === null || val === undefined) return fallback;
    if (typeof val !== 'string') return val;
    try {
        return JSON.parse(val);
    } catch (e) {
        if (typeof val === 'string' && val.startsWith('/')) return [val];
        return fallback;
    }
};

export async function addAgentProduct(productData: Product): Promise<{ success: boolean; product?: Product; error?: string }> {
  // Simulate saving to DB
  const newProduct: Product = {
    ...productData,
    id: `prod-mock-${Date.now()}`,
    image: productData.images[0]
  };
  
  console.log('[Product Action] New product added (simulated):', newProduct);

  return { success: true, product: newProduct };
}


export async function deleteAgentProduct(productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.query('DELETE FROM products WHERE id = $1', [productId]);
    return { success: true };
  } catch(error) {
    const dbError = await handleDbError(error, 'deleting agent product');
    return { success: false, error: dbError.error };
  }
}

export async function getAgentProducts(agentId: number): Promise<Product[]> {
    try {
        const { rows } = await db.query(`
            SELECT p.*, b.name as boutiqueName, u.full_name as sellerName, u.id as sellerId, u.id_wallet as sellerWalletId, u.country as countryCode
            FROM products p
            LEFT JOIN boutiques b ON p.boutique_id = b.id
            LEFT JOIN users u ON p.agent_id = u.id
            WHERE p.agent_id = $1
        `, [agentId]);
        
        return rows.map(row => {
            const images = safeParse(row.images, []);
            const promotionalPackages = safeParse(row.promotional_packages, null);
            const shippingRates = safeParse(row.shipping_rates, []);
            const variations = safeParse(row.variations, []);
            const details = safeParse(row.details, null);
            return {
                id: row.id.toString(),
                name: row.name,
                description: row.description,
                details: details,
                image: images[0] || 'https://placehold.co/100x100.png',
                images: images,
                purchasePrice: parseFloat(row.purchase_price),
                sellingPrice: parseFloat(row.selling_price),
                currency: 'USD',
                weight: parseFloat(row.weight),
                shippingRates: shippingRates,
                promotionalPackages: promotionalPackages,
                variations: variations,
                barcode: row.barcode,
                stock: Number(row.stock),
                categoryId: row.category_id,
                boutiqueId: row.boutique_id.toString(),
                boutiqueName: row.boutiqueName,
                isPublic: Boolean(row.is_public),
                countryCode: row.countryCode,
                sellerWalletId: row.sellerWalletId,
                seller: { id: row.sellerId.toString(), name: row.sellerName }, 
                createdAt: new Date(row.created_at).toISOString(),
            }
        });
    } catch (error) {
        await handleDbError(error, 'fetching agent products');
        return [];
    }
}
