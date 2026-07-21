import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

const updateCountrySchema = z.object({
  name: z.string().min(3),
  dial_code: z.string().startsWith('+'),
  flag_emoji: z.string().min(1),
});

export async function PATCH(request: Request, { params }: { params: { code: string } }) {
  try {
    const { code } = params;
    const body = await request.json();

    // Check if it's a status update or a full data update
    const statusValidation = updateStatusSchema.safeParse(body);
    if (statusValidation.success) {
        const { status } = statusValidation.data;
        await db.query('UPDATE countries SET status = $1 WHERE code = $2', [status, code]);
        return NextResponse.json({ message: 'Status updated successfully' });
    }

    const countryValidation = updateCountrySchema.safeParse(body);
    if (countryValidation.success) {
        const { name, dial_code, flag_emoji } = countryValidation.data;
        await db.query('UPDATE countries SET name = $1, dial_code = $2, flag_emoji = $3 WHERE code = $4', [name, dial_code, flag_emoji, code]);
        return NextResponse.json({ message: 'Country updated successfully' });
    }
    
    return NextResponse.json({ error: 'Invalid input for update' }, { status: 400 });

  } catch (error) {
    console.error('API Error updating country:', error);
    return NextResponse.json({ error: 'Failed to update country' }, { status: 500 });
  }
}
