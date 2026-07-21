
import { type NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getCustomerAccounts } from '@/services/mastercard-open-banking';
import { storeLinkedAccount } from '@/lib/actions/open-banking.actions';

/**
 * Handles the redirect from the Mastercard Connect widget after a user
 * links their bank account. It exchanges the authorization code for an
 * access token and stores the new linked account details.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const customerId = searchParams.get('customerId'); // Our internal user ID

  if (!code || !customerId) {
    return new NextResponse(
        '<h1>Erreur de Connexion</h1><p>Le code d\'autorisation ou l\'ID utilisateur est manquant. Veuillez réessayer.</p>',
        { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }
  
  try {
    const userId = parseInt(customerId, 10);
    if (isNaN(userId)) {
        throw new Error('ID Client invalide.');
    }

    // Exchange the one-time code for a permanent access token
    const tokenResponse = await exchangeCodeForToken(code);
    if (!tokenResponse.success || !tokenResponse.accessToken) {
      throw new Error(tokenResponse.error || 'Impossible d\'échanger le code contre un jeton d\'accès.');
    }
    const accessToken = tokenResponse.accessToken;
    
    // Use the new access token to fetch the list of accounts the user linked
    const accountsResponse = await getCustomerAccounts(accessToken);
    if (!accountsResponse.success || !accountsResponse.accounts) {
        throw new Error(accountsResponse.error || 'Impossible de récupérer les comptes liés.');
    }
    
    // Save each linked account to the database
    for (const account of accountsResponse.accounts) {
        await storeLinkedAccount({
            userId,
            institutionName: account.institutionName,
            accountType: account.accountType,
            accountNumberMask: account.accountNumberMask,
            providerAccountId: account.providerAccountId,
            mastercardAccessToken: accessToken,
        });
    }

    // Display a success message to the user
    return new NextResponse(
        '<h1>Connexion Réussie!</h1><p>Votre compte bancaire a été lié avec succès. Vous pouvez maintenant fermer cette fenêtre.</p>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error: any) {
    console.error('[Mastercard Callback Error]', error);
    return new NextResponse(
        `<h1>Erreur</h1><p>Une erreur est survenue : ${error.message}</p>`,
        { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
