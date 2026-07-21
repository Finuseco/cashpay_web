
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { countries } from '@/lib/countries';

// This schema is a simplified version for client self-registration
const clientRegisterSchema = z.object({
  firstName: z.string().min(2, "Le prénom est requis."),
  lastName: z.string().min(2, "Le nom est requis."),
  phone: z.string().min(9, "Le numéro de téléphone est requis."),
  email: z.string().email("Adresse email invalide.").optional().or(z.literal('')),
  country: z.string().min(2, "Le pays est requis."),
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
  // Agency is optional, defaults to '01'
  agencyId: z.string().optional().default('01'), 
});

export async function POST(request: Request) {
  const connection = await db.getConnection();
  try {
    const body = await request.json();
    const validation = clientRegisterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const data = validation.data;
    
    await connection.query('BEGIN');

    // Check for duplicate user
    const { rows: existingUser } = await connection.query('SELECT id FROM users WHERE phone = $1', [data.phone]);
    if (existingUser.length > 0) {
      throw new Error('Un utilisateur avec ce numéro de téléphone existe déjà.');
    }

    // Lock the agency row to prevent race conditions
    const { rows: agencyRows } = await connection.query('SELECT last_client_id_sequence FROM agencies WHERE id = $1 FOR UPDATE', [data.agencyId]);
    if (agencyRows.length === 0) {
        throw new Error("L'agence par défaut n'existe pas. Contactez le support.");
    }
    const currentSequence = agencyRows[0].last_client_id_sequence;
    const newSequence = currentSequence + 1;

    // --- INTERNATIONAL WALLET ID ALGORITHM ---
    const countryData = countries.find(c => c.name === data.country);
    if (!countryData) {
        throw new Error(`Le pays '${data.country}' est invalide.`);
    }
    const countryCode = countryData.code.toUpperCase();
    const agencyCode = String(data.agencyId).padStart(2, '0');
    const clientSequence = String(newSequence).padStart(8, '0');
    const id_wallet = `${countryCode}${agencyCode}${clientSequence}`;
    // --- END ---

    const userId = randomUUID();
    const pinHash = await bcrypt.hash(data.pin, 10);

    const userForDb = {
        id: userId,
        uid: userId,
        id_wallet,
        role: 'Client',
        status: 'Active',
        account_type: 'national',
        full_name: `${data.firstName} ${data.lastName}`,
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        email: data.email || null,
        pin_hash: pinHash,
        country: data.country,
        created_at: new Date(),
    };
    
    await connection.query('INSERT INTO users (id, uid, id_wallet, role, status, account_type, full_name, first_name, last_name, phone, email, pin_hash, country, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)', Object.values(userForDb));
    
    const walletForDb = {
        id_wallet,
        user_id: userId,
        balances: JSON.stringify({ USD: 0, CDF: 0, EUR: 0, [countryData.currency_code]: 0 }),
        commission_balance: JSON.stringify({ USD: 0 }),
        last_updated: new Date()
    };
    await connection.query('INSERT INTO wallets (id_wallet, user_id, balances, commission_balance, last_updated) VALUES ($1, $2, $3, $4, $5)', Object.values(walletForDb));
    
    await connection.query('UPDATE agencies SET last_client_id_sequence = $1 WHERE id = $2', [newSequence, data.agencyId]);

    await connection.query('COMMIT');

    return NextResponse.json({
         message: 'Account created successfully',
         user: {
            userId,
            id_wallet,
            name: userForDb.full_name,
            phone: userForDb.phone,
         } 
    }, { status: 201 });

  } catch (error) {
    await connection.query('ROLLBACK');
    console.error('Client Registration API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create user account.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    connection.release();
  }
}
