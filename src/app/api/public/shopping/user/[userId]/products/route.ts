import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const safeParse = (value: unknown, fallback: any) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        if (value.startsWith('/') || value.startsWith('http')) {
            return [value];
        }
        return fallback;
    }
};

export async function GET(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const userId = Number.parseInt(params.userId, 10);

        if (!Number.isInteger(userId) || userId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid userId'
                },
                { status: 400 }
            );
        }

        const storeIdParam = request.nextUrl.searchParams.get('storeId');

        let storeId: number | null = null;

        if (storeIdParam !== null) {
            storeId = Number.parseInt(storeIdParam, 10);

            if (!Number.isInteger(storeId) || storeId <= 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Invalid storeId'
                    },
                    { status: 400 }
                );
            }
        }

        /*
         * Si une boutique précise est demandée,
         * elle doit réellement appartenir à l'utilisateur.
         */
        if (storeId !== null) {
            const boutiqueResult = await db.query(
                `
                SELECT id, name, address, whatsapp_public_number
                FROM boutiques
                WHERE id = $1
                  AND agent_id = $2
                LIMIT 1
                `,
                [storeId, userId]
            );

            if (boutiqueResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Boutique not found for this user'
                    },
                    { status: 404 }
                );
            }
        }

        const values: Array<number> = [userId];

        let storeCondition = '';

        if (storeId !== null) {
            values.push(storeId);
            storeCondition = `AND p.boutique_id = $${values.length}`;
        }

        const { rows } = await db.query(
            `
            SELECT
                p.id,
                p.name,
                p.description,
                p.images,
                p.selling_price,
                p.stock,
                p.barcode,
                p.variations,
                p.promotional_packages,
                p.weight,
                p.shipping_rates,
                p.category_id,
                p.boutique_id,
                p.is_public,
                p.details,
                p.created_at,
                p.view_count,
                p.review_count,
                p.rating_average,

                b.name AS "boutiqueName",
                b.address AS "boutiqueAddress",
                b.whatsapp_public_number AS "whatsappPublicNumber",

                u.id AS "sellerId",
                u.id_wallet AS "sellerWalletId",
                u.full_name AS "sellerName",
                u.country AS "countryCode",

                COALESCE(
                    (
                        SELECT COUNT(DISTINCT o.id)
                        FROM orders o
                        JOIN order_items oi ON oi.order_id = o.id
                        WHERE oi.product_id = p.id
                          AND o.status = 'delivered'
                    ),
                    0
                ) AS "orderCount",

                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM product_comments pc
                        WHERE pc.product_id = p.id
                    ),
                    0
                ) AS "commentCount"

            FROM products p
            INNER JOIN boutiques b
                ON b.id = p.boutique_id
               AND b.agent_id = $1

            INNER JOIN users u
                ON u.id = p.agent_id

            WHERE p.agent_id = $1
              AND p.is_public = true
              AND p.stock > 0
              AND u.status = 'Active'
              ${storeCondition}

            ORDER BY p.created_at DESC
            `,
            values
        );

        const products = rows.map((row) => {
            const toPublicImageUrl = (value: unknown) => { if (!value || typeof value !== "string") return null; if (/^https?:\/\//i.test(value)) return value; return `https://app.cashpay-all.com/${value.replace(/^\/+/, "")}`; };
            const images = safeParse(row.images, []);
            const details = safeParse(row.details, {});

            return {
                id: row.id.toString(),
                name: row.name,
                description: row.description,
                image: toPublicImageUrl(images[0]),
                images: images.map(toPublicImageUrl).filter(Boolean),
                sellingPrice: Number(row.selling_price),
                currency: 'USD',
                stock: Number(row.stock),
                barcode: row.barcode,
                variations: safeParse(row.variations, []),
                promotionalPackages: safeParse(
                    row.promotional_packages,
                    null
                ),
                weight: Number(row.weight || 0),
                shippingRates: safeParse(row.shipping_rates, []),
                categoryId: row.category_id,

                boutique: {
                    id: row.boutique_id?.toString() || '',
                    name: row.boutiqueName,
                    address: row.boutiqueAddress,
                    whatsappPublicNumber:
                        row.whatsappPublicNumber || null
                },

                seller: {
                    id: row.sellerId?.toString() || '',
                    walletId: row.sellerWalletId || null,
                    name: row.sellerName || null,
                    countryCode: row.countryCode || null
                },

                isPublic: Boolean(row.is_public),
                details,

                viewCount: Number(row.view_count || 0),
                orderCount: Number(row.orderCount || 0),
                commentCount: Number(row.commentCount || 0),
                reviewCount: Number(row.review_count || 0),
                ratingAverage: Number(row.rating_average || 0),

                createdAt: row.created_at
                    ? new Date(row.created_at).toISOString()
                    : null
            };
        });

        return NextResponse.json({
            success: true,
            userId: userId.toString(),
            storeId: storeId?.toString() || null,
            count: products.length,
            products
        });
    } catch (error) {
        console.error(
            'Public shopping products API error:',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: 'Unable to load products'
            },
            { status: 500 }
        );
    }
}
