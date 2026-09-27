import 'server-only';

const SENDBIRD_APP_ID =
    process.env.SENDBIRD_APP_ID;

const SENDBIRD_API_TOKEN =
    process.env.SENDBIRD_API_TOKEN;

if (!SENDBIRD_APP_ID) {
    throw new Error(
        'SENDBIRD_APP_ID is not configured.'
    );
}

if (!SENDBIRD_API_TOKEN) {
    throw new Error(
        'SENDBIRD_API_TOKEN is not configured.'
    );
}

const SENDBIRD_API_URL =
    `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3`;

export const SENDBIRD_PARTNER = {
    name: 'Sendbird',
    appId: SENDBIRD_APP_ID,
    apiUrl: SENDBIRD_API_URL,
};

type SendbirdRequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    body?: unknown;
};

async function sendbirdRequest<T>({
    method = 'GET',
    path,
    body,
}: SendbirdRequestOptions): Promise<T> {
    const response = await fetch(
        `${SENDBIRD_API_URL}${path}`,
        {
            method,
            headers: {
                'Content-Type':
                    'application/json',
                'Api-Token':
                    SENDBIRD_API_TOKEN,
            },
            body:
                body === undefined
                    ? undefined
                    : JSON.stringify(body),
            cache: 'no-store',
        }
    );

    const responseText =
        await response.text();

    let data: unknown = null;

    if (responseText) {
        try {
            data =
                JSON.parse(responseText);
        } catch {
            data = {
                message: responseText,
            };
        }
    }

    if (!response.ok) {
        console.error(
            '[SENDBIRD API ERROR]',
            {
                status: response.status,
                data,
            }
        );

        throw new Error(
            `Sendbird API error: ${response.status}`
        );
    }

    return data as T;
}

export type SendbirdUser = {
    user_id: string;
    nickname?: string;
    profile_url?: string;
    access_token?: string;
};

export function getSendbirdUserId(
    userId: number
): string {
    return `cashpay_${userId}`;
}

export async function createOrUpdateSendbirdUser(
    userId: number,
    nickname: string,
    profileUrl?: string | null
): Promise<SendbirdUser> {
    const sendbirdUserId =
        getSendbirdUserId(userId);

    return sendbirdRequest<SendbirdUser>({
        method: 'PUT',
        path:
            `/users/${encodeURIComponent(
                sendbirdUserId
            )}`,
        body: {
            user_id:
                sendbirdUserId,
            nickname,
            profile_url:
                profileUrl || undefined,
            issue_access_token:
                true,
        },
    });
}

export async function getSendbirdUser(
    userId: number
): Promise<SendbirdUser> {
    const sendbirdUserId =
        getSendbirdUserId(userId);

    return sendbirdRequest<SendbirdUser>({
        method: 'GET',
        path:
            `/users/${encodeURIComponent(
                sendbirdUserId
            )}`,
    });
}

export async function deleteSendbirdUser(
    userId: number
): Promise<void> {
    const sendbirdUserId =
        getSendbirdUserId(userId);

    await sendbirdRequest({
        method: 'DELETE',
        path:
            `/users/${encodeURIComponent(
                sendbirdUserId
            )}`,
    });
}
