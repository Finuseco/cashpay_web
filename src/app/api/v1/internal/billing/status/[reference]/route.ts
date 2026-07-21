
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiSignature } from '@/lib/api-security';

/**
 * Récupère le statut d'une transaction de facturation interne.
 */
export async function GET(request: Request, { params }: { params: { reference: string } }) {
    const security = await validateApiSignature(request);
    if (!security.isValid) {
        return NextResponse.json({ success: false, error: security.error }, { status: 401 });
    }

    try {
        const { reference } = params;

        const { rows } = await db.query(`
            SELECT 
                reference_code as reference,
                status,
                amount,
                currency,
                description,
                created_at as date
            FROM transactions 
            WHERE reference_code = $1 OR (metadata->>'external_ref' = $1)
            LIMIT 1
        `, [reference]);

        if (rows.length === 0) {
            return NextResponse.json({ success: true, found: false, error: "Transaction introuvable." }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            found: true,
            data: rows[0]
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
    }
}
