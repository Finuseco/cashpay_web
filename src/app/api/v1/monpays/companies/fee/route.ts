import { NextResponse } from 'next/server';
import { getMonPaysCreationFee } from '@/lib/actions/monpays.actions';

export const dynamic = 'force-dynamic';

/** Frais de création d'une page, dans la devise demandée : GET ?currency=CDF */
export async function GET(request: Request) {
    const currency = new URL(request.url).searchParams.get('currency') || 'USD';
    const result = await getMonPaysCreationFee(currency);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
