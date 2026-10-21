import { NextResponse } from 'next/server';
import { validateApiSignature } from '@/lib/api-security';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
  getTvPackages,
  executeTvSubscription,
} from '@/lib/ussd/ussd.actions';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentification requise.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider')?.trim();

  if (!provider) {
    return NextResponse.json(
      { success: false, error: 'Le fournisseur TV est requis.' },
      { status: 400 }
    );
  }

  const packages = await getTvPackages(provider);

  return NextResponse.json({
    success: true,
    provider,
    packages,
  });
}

export async function POST(request: Request) {
  const security = await validateApiSignature(request);

  if (!security.isValid) {
    return NextResponse.json(
      { success: false, error: security.error },
      { status: 401 }
    );
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentification requise.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { provider, packageId, smartcardNumber, currency, pin } = body;

    if (!provider || !packageId || !pin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Fournisseur, forfait et code PIN requis.',
        },
        { status: 400 }
      );
    }

    const result = await executeTvSubscription(
      user,
      String(provider),
      String(smartcardNumber || ''),
      { id: Number(packageId) },
      String(currency || ''),
      String(pin)
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Requête invalide ou erreur interne.' },
      { status: 400 }
    );
  }
}


