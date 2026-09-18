import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const BASE_URL = "https://app.cashpay-all.com";

function escapeXml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function absoluteUrl(value: unknown): string {
    const url = String(value ?? "").trim();

    if (!url) return "";

    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }

    return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getFirstImage(value: unknown): string {
    try {
        if (Array.isArray(value)) {
            return absoluteUrl(value[0]);
        }

        if (typeof value === "string") {
            const parsed = JSON.parse(value);

            if (Array.isArray(parsed)) {
                return absoluteUrl(parsed[0]);
            }

            if (typeof parsed === "string") {
                return absoluteUrl(parsed);
            }
        }
    } catch {
        return absoluteUrl(value);
    }

    return "";
}

export async function GET() {
    try {
        const { rows } = await db.query(`
            SELECT
                p.id,
                p.name,
                p.description,
                p.selling_price,
                p.images,
                p.created_at
            FROM products p
            JOIN users u ON p.agent_id = u.id
            LEFT JOIN agent_subscriptions subs ON u.id = subs.user_id
            WHERE p.is_public = true
              AND p.stock > 0
              AND u.status = 'Active'
              AND (subs.status = 'active' OR u.role = 'Admin')
            ORDER BY p.created_at DESC
            LIMIT 100
        `);

        const items = rows.map((product) => {
            const productUrl = `${BASE_URL}/shopping/${product.id}`;
            const imageUrl = getFirstImage(product.images);

            const description = [
                product.description || product.name,
                product.selling_price != null
                    ? `Prix : ${product.selling_price} USD`
                    : ""
            ]
                .filter(Boolean)
                .join(" — ");

            return `
        <item>
            <title>${escapeXml(product.name)}</title>
            <link>${escapeXml(productUrl)}</link>
            <guid isPermaLink="true">${escapeXml(productUrl)}</guid>
            <description>${escapeXml(description)}</description>
            <pubDate>${new Date(product.created_at).toUTCString()}</pubDate>
            ${
                imageUrl
                    ? `<enclosure url="${escapeXml(imageUrl)}" type="image/jpeg" />`
                    : ""
            }
        </item>`;
        }).join("");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>CashPay All Shopping</title>
        <link>${BASE_URL}/shopping</link>
        <description>Produits disponibles sur CashPay All Shopping</description>
        <language>fr</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        ${items}
    </channel>
</rss>`;

        return new NextResponse(xml, {
            status: 200,
            headers: {
                "Content-Type": "application/rss+xml; charset=utf-8",
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
            }
        });
    } catch (error) {
        console.error("Shopping RSS error:", error);

        return new NextResponse("RSS generation failed", {
            status: 500,
            headers: {
                "Content-Type": "text/plain; charset=utf-8"
            }
        });
    }
}
