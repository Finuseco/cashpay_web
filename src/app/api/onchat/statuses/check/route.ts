import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getPublicUrl(value: unknown): string | null {
    if (!value) return null;

    const content = String(value);

    if (content.startsWith('https://') || content.startsWith('http://')) {
        return content;
    }

    if (!content.startsWith('/')) {
        return content;
    }

    const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        'https://app.cashpay-all.com';

    return `${baseUrl.replace(/\/$/, '')}${content}`;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phoneNumbers } = body;

        if (!Array.isArray(phoneNumbers)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'phoneNumbers must be an array.'
                },
                { status: 400 }
            );
        }

        if (phoneNumbers.length === 0) {
            return NextResponse.json({
                success: true,
                contacts: []
            });
        }

        /*
         * OnChat status matching:
         * - country code ignored
         * - leading zero/prefix ignored
         * - only the last 9 digits are used
         */
        const normalizedNumbers = phoneNumbers
            .map((phone) =>
                String(phone)
                    .replace(/\D/g, '')
                    .slice(-9)
            )
            .filter((phone) => phone.length === 9);

        if (normalizedNumbers.length === 0) {
            return NextResponse.json({
                success: true,
                contacts: []
            });
        }

        const conditions = normalizedNumbers
            .map(
                (_, index) =>
                    `RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9) = $${index + 1}`
            )
            .join(' OR ');

        /*
         * Only active statuses are joined.
         * Expired statuses are therefore never returned to mobile.
         */
        const { rows } = await db.query(
            `
            SELECT
                u.id,
                u.full_name,
                u.profile_photo,
                u.phone,

                s.id AS status_id,
                s.type AS status_type,
                s.content AS status_content,
                s.background_color AS status_background_color,
                s.created_at AS status_created_at,
                s.expires_at AS status_expires_at

            FROM users u

            LEFT JOIN statuses s
                ON s.user_id = u.id
                AND s.expires_at > NOW()

            WHERE ${conditions}

            ORDER BY
                u.id,
                s.created_at DESC
            `,
            normalizedNumbers
        );

        const usersByPhone = new Map<string, any>();

        for (const row of rows) {
            const normalizedUserPhone = String(row.phone || '')
                .replace(/\D/g, '')
                .slice(-9);

            if (normalizedUserPhone.length !== 9) {
                continue;
            }

            let user = usersByPhone.get(normalizedUserPhone);

            if (!user) {
                user = {
                    id: row.id,
                    full_name: row.full_name,
                    profile_photo: row.profile_photo,
                    phone: row.phone,
                    statuses: []
                };

                usersByPhone.set(normalizedUserPhone, user);
            }

            if (row.status_id !== null) {
                const isMedia =
                    row.status_type === 'image' ||
                    row.status_type === 'video';

                user.statuses.push({
                    id: row.status_id,
                    type: row.status_type,
                    content: isMedia
                        ? getPublicUrl(row.status_content)
                        : row.status_content,
                    backgroundColor:
                        row.status_background_color || null,
                    createdAt: row.status_created_at,
                    expiresAt: row.status_expires_at
                });
            }
        }

        const contacts = phoneNumbers.map((originalPhone) => {
            const normalized = String(originalPhone)
                .replace(/\D/g, '')
                .slice(-9);

            const user = usersByPhone.get(normalized);

            if (!user) {
                return {
                    phone: originalPhone,
                    normalizedPhone: normalized,
                    onChat: false,
                    user: null,
                    hasActiveStatus: false,
                    statuses: []
                };
            }

            return {
                phone: originalPhone,
                normalizedPhone: normalized,
                onChat: true,

                user: {
                    id: user.id,
                    full_name: user.full_name,
                    profile_photo: user.profile_photo,
                    phone: user.phone
                },

                hasActiveStatus: user.statuses.length > 0,
                statuses: user.statuses
            };
        });

        return NextResponse.json({
            success: true,
            contacts
        });
    } catch (error) {
        console.error(
            '[API OnChat Status Check] Error:',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: 'An internal server error occurred.'
            },
            { status: 500 }
        );
    }
}
