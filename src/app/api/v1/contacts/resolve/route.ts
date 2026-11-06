import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { db } from '@/lib/db';
import { contactPhone, contactCandidates } from '@/lib/contact-phone';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const viewer = await getAuthenticatedUser();
    if (!viewer) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
    const body = await request.json();
    if (!Array.isArray(body.phoneNumbers) || body.phoneNumbers.length > 250 || body.phoneNumbers.some((p: unknown) => typeof p !== 'string' || p.length > 64)) {
      return NextResponse.json({ success: false, error: 'Envoyez au maximum 250 numéros valides par lot.' }, { status: 400 });
    }
    const phones: string[] = [...new Set<string>(body.phoneNumbers)];
    const canonical = phones.map(phone => contactPhone(phone, viewer.country));
    const candidates = [...new Set(canonical.flatMap(phone => phone ? contactCandidates(phone, viewer.country) : []))];
    const { rows } = candidates.length ? await db.query(`
      SELECT id_wallet, full_name, first_name, last_name, phone, country, profile_photo, role
      FROM users WHERE id_wallet IS NOT NULL AND LOWER(TRIM(status::text))='active' AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = ANY($1::text[])
    `, [candidates]) : { rows: [] };
    const matches = new Map<string, typeof rows>();
    for (const row of rows) {
      const phone = contactPhone(row.phone || '', row.country);
      if (phone) matches.set(phone, [...(matches.get(phone) || []), row]);
    }
    const contacts = phones.map((phone, index) => {
      const found = canonical[index] ? matches.get(canonical[index]!) : undefined;
      const user = found?.length === 1 ? found[0] : null;
      return { phone, found: !!user, profile: user ? {
        walletId: user.id_wallet, fullName: user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' '),
        profilePhoto: user.profile_photo, profilePhotoUrl: user.profile_photo, role: user.role, country: user.country,
      } : null };
    });
    return NextResponse.json({ success: true, contacts }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[Contacts resolve] failed');
    return NextResponse.json({ success: false, error: 'Détection des contacts indisponible. Réessayez.' }, { status: 500 });
  }
}
