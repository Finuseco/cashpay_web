
'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { getZoomUserTokens, getZoomUserProfile } from '@/services/zoom';
import { linkZoomAccount, findUserByZoomId } from '@/lib/actions/user.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { cookies } from 'next/headers';
import config from '@/config';


/**
 * Handles the OAuth callback from Zoom.
 * It exchanges the authorization code for tokens, fetches the user's Zoom profile,
 * and then either links the Zoom account to an existing logged-in CashPay user
 * or attempts to log in a user if their Zoom account was previously linked.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const appUrl = config.app.nextPublicAppUrl;

    if (error) {
        console.error('Zoom Auth Callback Error:', error);
        // Using a more user-friendly redirect instead of a raw HTML response
        return NextResponse.redirect(new URL('/settings?error=zoom_auth_failed', appUrl));
    }

    if (!code) {
        return NextResponse.redirect(new URL('/settings?error=zoom_code_missing', appUrl));
    }

    try {
        // Exchange the code for tokens
        const tokenResult = await getZoomUserTokens(code);
        if (!tokenResult.success || !tokenResult.access_token) {
            throw new Error(tokenResult.error || 'Failed to get Zoom tokens.');
        }
        
        const { access_token, refresh_token } = tokenResult;

        // Fetch Zoom user profile
        const zoomProfile = await getZoomUserProfile(access_token);
        const { id: zoomId, email: zoomEmail } = zoomProfile;

        // Check if a CashPay user is already logged in (for linking accounts)
        const currentUser = await getAuthenticatedUser();

        if (currentUser) {
            // User is logged in, link this Zoom account to their CashPay account
            const linkResult = await linkZoomAccount(currentUser.id, zoomId, refresh_token!);
            if (linkResult.success) {
                // Redirect back to settings page with a success message
                 return NextResponse.redirect(new URL('/settings?zoom_linked=true', appUrl));
            } else {
                 throw new Error(linkResult.error || 'Failed to link Zoom account.');
            }
        } else {
            // No user is logged in, try to find a user by this Zoom ID to log them in
            const findResult = await findUserByZoomId(zoomId);
            if (findResult.success && findResult.user && findResult.token) {
                // User found, log them in
                cookies().set('cashpay-token', findResult.token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'strict', path: '/' });
                return NextResponse.redirect(new URL('/dashboard', appUrl));
            } else {
                // No user found with this Zoom ID. Redirect to registration with pre-filled email.
                return NextResponse.redirect(new URL(`/register?email=${encodeURIComponent(zoomEmail)}&source=zoom`, appUrl));
            }
        }

    } catch (err: any) {
        console.error('[Zoom Callback Error]', err);
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(err.message)}`, appUrl));
    }
}
