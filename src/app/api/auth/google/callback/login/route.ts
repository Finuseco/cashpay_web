
import { type NextRequest, NextResponse } from 'next/server';
import { getGoogleTokens, getGoogleUserProfile, linkGoogleAccount, findUserByGoogleId } from '@/lib/actions/google.actions';
import { logUserSessionAndNotify } from '@/lib/actions/auth.actions';
import { generateToken } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Google Auth Error:', error);
    return NextResponse.redirect(new URL('/login?error=google_auth_failed', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=google_code_missing', request.url));
  }

  try {
    const { success, id_token, access_token, error: tokenError } = await getGoogleTokens(code, 'login');
    if (!success || !id_token || !access_token) {
      throw new Error(tokenError || 'Failed to get Google tokens.');
    }

    const { email, google_id } = await getGoogleUserProfile(id_token, access_token);
    
    // Check if a user with this Google ID already exists
    let result = await findUserByGoogleId(google_id);

    // If not, maybe check if an account with this email exists and link it
    if (!result.success) {
      // You might want to add logic here to find user by email and then link
      // For now, we'll assume a new user or a direct link.
    }
    
    if (result.success && result.user && result.token) {
        const { user, token } = result;
        cookies().set('cashpay-token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'strict', path: '/' });
        
        // Log session and send notification email
        await logUserSessionAndNotify(user);

        return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
        // Handle case where user is not found or some other error occurs
        // Maybe redirect to a page to complete registration
        return NextResponse.redirect(new URL('/register?error=account_not_found', request.url));
    }
  } catch (err: any) {
    console.error('[Google Login Callback Error]', err);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err.message)}`, request.url));
  }
}
