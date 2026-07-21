
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { randomInt } from 'crypto';

const resendSchema = z.object({
  cpNumber: z.string().min(1, 'Le numéro CP est requis.'),
  method: z.enum(['sms', 'email']),
});

const generateOtp = () => {
    return randomInt(100000, 999999).toString();
};

async function sendOtp(destination: string, otp: string, method: 'sms' | 'email') {
    console.log(`********************************************`);
    console.log(`* RESENDING OTP to ${destination} via ${method}: ${otp} *`);
    console.log(`********************************************`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = resendSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const { cpNumber, method } = validation.data;
    
    // 1. Find user
    const { rows } = await db.query(
        'SELECT id, phone, email FROM users WHERE id_wallet = $1', 
        [cpNumber]
    );

    const users = rows as any[];
    if (users.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé.' }, { status: 404 });
    }
    const userData = users[0];
    
    const destination = method === 'sms' ? userData.phone : userData.email;
    if (!destination) {
        return NextResponse.json({ error: `Aucun ${method === 'sms' ? 'numéro de téléphone' : 'email'} trouvé pour ce compte.` }, { status: 400 });
    }

    // 2. Generate and store new OTP
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const otpRequest = {
        user_id: userData.id,
        code: otpCode,
        type: 'login',
        channel: method,
        expires_at: expiresAt,
        used: false,
    };
    
    await db.query('INSERT INTO otps (user_id, code, type, channel, expires_at, used) VALUES ($1, $2, $3, $4, $5, $6)', Object.values(otpRequest));
    
    await sendOtp(destination, otpCode, method);
    
    return NextResponse.json({ message: `Un nouveau code a été envoyé à votre ${method === 'sms' ? 'téléphone' : 'email'}.` }, { status: 200 });

  } catch (error) {
    console.error('Resend OTP API error:', error);
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 });
  }
}
