
'use server';

/**
 * @fileOverview Service de communication avec l'API Zoom via OAuth Utilisateur.
 * Permet aux utilisateurs de créer des réunions sur leurs propres comptes.
 */
import config from '@/config';

const API_BASE_URL = 'https://api.zoom.us/v2';
const ZOOM_CLIENT_ID = config.apiKeys.zoomClientId;
const ZOOM_CLIENT_SECRET = config.apiKeys.zoomClientSecret;

/**
 * Génère l'URL d'autorisation OAuth Zoom.
 */
export async function getZoomOauthUrl(): Promise<string> {
    const redirectUri = config.app.zoomCallbackUrl;
    const clientId = ZOOM_CLIENT_ID;
    return `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri!)}`;
}

/**
 * Récupère les jetons d'accès OAuth pour un utilisateur à partir du code d'autorisation.
 */
export async function getZoomUserTokens(code: string): Promise<{ success: boolean; access_token?: string; refresh_token?: string; error?: string }> {
    const redirectUri = config.app.zoomCallbackUrl;
    const authHeader = `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}`;

    try {
        const response = await fetch('https://zoom.us/oauth/token', {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri!,
            }),
            cache: 'no-store'
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('[Zoom OAuth Error]', data);
            return { success: false, error: data.reason || 'Échec de l\'échange de jetons.' };
        }

        return { success: true, access_token: data.access_token, refresh_token: data.refresh_token };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Rafraîchit un jeton d'accès expiré.
 */
export async function refreshZoomToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const authHeader = `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')}`;

    const response = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
        cache: 'no-store'
    });

    const data = await response.json();
    if (!response.ok) throw new Error("Impossible de rafraîchir le jeton Zoom.");
    return { access_token: data.access_token, refresh_token: data.refresh_token };
}

/**
 * Récupère le profil de l'utilisateur Zoom.
 */
export async function getZoomUserProfile(accessToken: string) {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.json();
}

/**
 * Crée un meeting sur le compte de l'utilisateur.
 */
export async function createZoomMeetingForUser(accessToken: string, meetingData: { topic: string; agenda: string; start_time: string }) {
    const response = await fetch(`${API_BASE_URL}/users/me/meetings`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...meetingData,
            type: 2, // Scheduled meeting
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: false,
                mute_upon_entry: true,
                waiting_room: true,
                approval_type: 0, // 0 - Automatically approve registrants
            }
        })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Échec de la création de la réunion Zoom.");
    return data;
}

/**
 * Alias pour la création d'événement Zoom.
 */
export async function createZoomEvent(accessToken: string, data: any) {
    return createZoomMeetingForUser(accessToken, data);
}

/**
 * Enregistre un participant à une réunion Zoom spécifique.
 */
export async function registerAttendeeForEvent(accessToken: string, meetingId: string, attendeeData: { email: string, first_name: string, last_name: string }) {
    const response = await fetch(`${API_BASE_URL}/meetings/${meetingId}/registrants`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(attendeeData)
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('[Zoom Registrant Error]', data);
        throw new Error(data.message || "Échec de l'enregistrement du participant sur Zoom.");
    }
    return data; // Returns { id, join_url, registrant_id, ... }
}
