
'use server';

import type { User } from '@/lib/types';
import { db } from '@/lib/db';
import { handleDbError } from '@/lib/actions/helpers';
import { generateToken } from '@/lib/jwt';
import { formatUser } from '../utils';
import config from '@/config';

const GOOGLE_CLIENT_ID = config.apiKeys.google;
const GOOGLE_CLIENT_SECRET = config.apiKeys.googleSecret;

const getRedirectUri = (state?: string) => {
    if (state === 'drive') {
        return config.app.googleDriveCallbackUrl;
    }
    return config.app.googleCallbackUrl;
}

export async function getGoogleOauthUrl(state?: string): Promise<string> {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  
  let scope = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
  ];

  if (state === 'drive') {
      scope.push('https://www.googleapis.com/auth/drive.file');
  }

  const options = {
    redirect_uri: getRedirectUri(state)!,
    client_id: GOOGLE_CLIENT_ID!,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: scope.join(' '),
    state: state || 'login', // Pass state to know the context in callback
  };

  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
}

export async function getGoogleTokens(code: string, state?: string): Promise<{ success: boolean; id_token?: string; access_token?: string; refresh_token?: string, error?: string; }> {
    const url = 'https://oauth2.googleapis.com/token';
    const values = {
      code,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(state)!,
      grant_type: 'authorization_code',
    };
  
    try {
        const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values),
        cache: 'no-store'
        });
    
        const data = await response.json();
        if (!response.ok) {
            console.error("Failed to fetch Google tokens:", data);
            throw new Error('Failed to fetch OAuth tokens.');
        }
        return { success: true, ...data };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function getGoogleUserProfile(id_token: string, access_token: string): Promise<{ email: string; google_id: string;}> {
    const response = await fetch(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
        { headers: { Authorization: `Bearer ${id_token}` } }
    );
    const data = await response.json();
    if (!response.ok) {
        console.error("Failed to fetch Google user profile:", data);
        throw new Error('Failed to fetch Google user profile.');
    }
    return { email: data.email, google_id: data.id };
}


export async function linkGoogleAccount(userId: number, googleId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userId]);
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'linking Google account');
        return { success: false, error: dbError.error };
    }
}

export async function findUserByGoogleId(googleId: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
        if (rows.length === 0) {
            return { success: false, error: 'Aucun compte CashPay n\'est associé à ce compte Google.' };
        }
        const user = formatUser(rows[0]);
        const token = generateToken(user);
        return { success: true, user, token };
    } catch (error) {
        const dbError = await handleDbError(error, 'finding user by Google ID');
        return { success: false, error: dbError.error };
    }
}


export async function uploadFileToDrive(file: File): Promise<{ success: boolean; fileId?: string, error?: string }> {
    console.log(`[Google Drive Service] Simulating upload of file: ${file.name}`);
    // This is a placeholder. In a real application, you would use the Google Drive API
    // with the user's access token to upload the file.
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate upload delay

    // Simulate success
    const mockFileId = `drive_mock_${Date.now()}`;
    console.log(`[Google Drive Service] Mock file uploaded with ID: ${mockFileId}`);

    return { success: true, fileId: mockFileId };
}
