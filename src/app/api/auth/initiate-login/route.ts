
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { randomInt } from 'crypto';

const loginSchema = z.object({
  cpNumber: z.string().min(1, 'Le numéro de compte est requis.'),
});

// A remplacer par un système de clés API sécurisé en base de données
const VALID_API_KEYS = ['CASHIOS_API_KEY_12345'];

// Function to generate a 6-digit OTP
const generateOtp = () => {
    return randomInt(100000, 999999).toString();
};

async function sendOtp(destination: string, otp: string, method: 'sms' | 'email') {
    // In a real scenario, you would trigger an SMS or email service here.
    // For now, we log it to the console for testing purposes.
    console.log(`********************************************`);
    console.log(`* OTP for ${destination} via ${method}: ${otp}   *`);
    console.log(`********************************************`);
}

export async function POST(request: Request) {
  // 1. Authenticate the client application
  const authHeader = request.headers.get('Authorization');
  const clientApiKey = authHeader?.split(' ')[1];

  if (!clientApiKey || !VALID_API_KEYS.includes(clientApiKey)) {
    return NextResponse.json({ error: 'Accès non autorisé. Clé API invalide.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const { cpNumber } = validation.data;
    
    // 2. Find the user by their wallet ID
    const { rows } = await db.query(
        'SELECT id, phone, email, profile_photo, full_name FROM users WHERE id_wallet = $1', 
        [cpNumber.toUpperCase()]
    );

    const users = rows as any[];
    if (users.length === 0) {
        return NextResponse.json({ error: 'Identifiant de compte incorrect.' }, { status: 404 });
    }
    const userData = users[0];
    
    if (!userData.phone) {
        return NextResponse.json({ error: 'Aucun numéro de téléphone n\'est associé à ce compte pour l\'envoi de code.' }, { status: 400 });
    }

    // 3. Generate and store OTP
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Using the 'otps' table now
    const otpRequest = {
        user_id: userData.id,
        code: otpCode,
        type: 'login',
        channel: 'sms',
        expires_at: expiresAt,
        used: false,
    };
    
    await db.query('INSERT INTO otps (user_id, code, type, channel, expires_at, used) VALUES ($1, $2, $3, $4, $5, $6)', Object.values(otpRequest));

    await sendOtp(userData.phone, otpCode, 'sms');

    // 4. Return success message and identifiers for OTP page
    return NextResponse.json({ 
        message: 'OTP sent successfully',
        userId: userData.id, // Return the internal user ID
        cpNumber: cpNumber.toUpperCase(),
        profile_photo_url: userData.profile_photo
    }, { status: 200 });

  } catch (error) {
    console.error('Initiate Login API error:', error);
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 });
  }
}
