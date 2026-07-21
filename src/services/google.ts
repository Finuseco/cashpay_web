
'use server';

import config from '@/config';

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
        client_id: config.apiKeys.google!,
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: scope.join(' '),
        state: state || 'login',
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
}

function getRedirectUri(state?: string) {
    if (state === 'drive') {
        return config.app.googleDriveCallbackUrl;
    }
    return config.app.googleCallbackUrl;
}

export async function getGoogleTokens(code: string, state?: string): Promise<{ success: boolean; id_token?: string; access_token?: string; refresh_token?: string, error?: string; }> {
    const url = 'https://oauth2.googleapis.com/token';
    const values = {
      code,
      client_id: config.apiKeys.google!,
      client_secret: config.apiKeys.googleSecret!,
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

export async function uploadFileToDrive(file: File): Promise<{ success: boolean; fileId?: string, error?: string }> {
    console.log(`[Google Drive Service] Simulating upload of file: ${file.name}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const mockFileId = `drive_mock_${Date.now()}`;
    console.log(`[Google Drive Service] Mock file uploaded with ID: ${mockFileId}`);
    return { success: true, fileId: mockFileId };
}
