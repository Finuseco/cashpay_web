import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createMonPaysCompany, getCompaniesForUser } from '@/lib/actions/monpays.actions';

export const dynamic = 'force-dynamic';

/** Mes pages entreprise (toutes, y compris « en attente de validation »). */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const companies = await getCompaniesForUser(user.id);
    return NextResponse.json({ success: true, companies });
}

/**
 * Création d'une page entreprise (mobile et web : même logique serveur que le formulaire web).
 * Corps JSON : { name, category, country, website?, address?, rccm?, nif?, phone?, email?,
 *                logoUrl? (data URI), bannerUrl? (data URI), paymentCurrency, pin }
 * Les frais sont débités du portefeuille de l'utilisateur connecté ; la page est créée « pending ».
 */
export async function POST(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Corps JSON invalide.' }, { status: 400 });
    }

    const { pin, ...companyData } = body || {};
    if (!pin || !/^\d{4}$/.test(String(pin))) {
        return NextResponse.json({ success: false, error: 'Code PIN à 4 chiffres requis.' }, { status: 400 });
    }
    if (!companyData.name || !String(companyData.name).trim()) {
        return NextResponse.json({ success: false, error: "Le nom de l'entreprise est requis." }, { status: 400 });
    }
    if (!companyData.category || !companyData.country) {
        return NextResponse.json({ success: false, error: 'Catégorie et pays requis.' }, { status: 400 });
    }

    const result = await createMonPaysCompany({ user, pin: String(pin), companyData });
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
