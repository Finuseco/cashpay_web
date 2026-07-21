import { type NextRequest, NextResponse } from 'next/server';
import { getGoogleTokens, getGoogleUserProfile } from '@/services/google';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Google Auth Error:', error);
    return new NextResponse(`<h1>Erreur de Connexion</h1><p>Une erreur est survenue lors de la connexion à Google: ${error}</p>`, { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  if (!code) {
    return new NextResponse('<h1>Erreur de Connexion</h1><p>Le code d\'autorisation est manquant. Veuillez réessayer.</p>', { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  try {
    const { id_token, access_token } = await getGoogleTokens(code, 'drive');
    
    // In a real app, you would securely store the access_token (and refresh_token)
    // in your database, associated with the user's ID.
    // For this demo, we'll just store a flag in localStorage.
    
    // It's crucial to close this window and signal to the parent window that the process is complete.
    return new NextResponse(
      `
      <script>
        localStorage.setItem('gdrive_token_linked', 'true');
        window.opener.location.reload(); // Reload the main app window
        window.close(); // Close this popup
      </script>
      <h1>Connexion Réussie!</h1>
      <p>Votre compte Google Drive a été lié avec succès. Cette fenêtre va se fermer automatiquement.</p>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err: any) {
    console.error('[Google Drive Callback Error]', err);
    return new NextResponse(`<h1>Erreur</h1><p>Une erreur est survenue lors de la liaison du compte : ${err.message}</p>`, { status: 500, headers: { 'Content-Type': 'text/html' } });
  }
}
