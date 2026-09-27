'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { createStatus, getStatusesForUser } from '@/lib/actions/status.actions';
import { z } from 'zod';

const statusSchema = z.object({
    userId: z.coerce.number().int().positive(),
    type: z.enum(['text', 'image', 'video']),
    content: z.string().min(1),
    backgroundColor: z.string().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const userId = Number(searchParams.get('userId'));

        if (!Number.isInteger(userId) || userId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'userId invalide.',
                },
                { status: 400 }
            );
        }

        const statusGroups = await getStatusesForUser(userId);

        return NextResponse.json({
            success: true,
            statusGroups,
        });
    } catch (error) {
        console.error('[API OnChat GET Statuses] Error:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'An internal server error occurred.',
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = statusSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid data',
                    details: validation.error.flatten(),
                },
                { status: 400 }
            );
        }

        const {
            userId,
            type,
            content,
            backgroundColor,
        } = validation.data;

        const result = await createStatus({
            userId,
            type,
            content,
            backgroundColor,
        });

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: 'Status posted.',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[API OnChat POST Status] Error:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'An internal server error occurred.',
            },
            { status: 500 }
        );
    }
}
