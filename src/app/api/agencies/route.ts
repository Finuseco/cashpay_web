
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

const createAgencySchema = z.object({
  agencyName: z.string().min(3, 'Le nom de l\'agence est requis.'),
  agencyAddress: z.string().min(10, 'L\'adresse de l\'agence est requise.'),
  managerName: z.string().min(3, 'Le nom du manager est requis.'),
  managerEmail: z.string().email('Email du manager invalide.'),
  managerPhone: z.string().min(9, 'Téléphone du manager invalide.'),
  managerPassword: z.string().min(6, 'Le mot de passe du manager doit contenir au moins 6 caractères.'),
});

export async function GET() {
  try {
    const query = `
      SELECT 
        a.id, 
        a.name, 
        a.address, 
        u.full_name as "managerName", 
        u.phone as "managerContact", 
        a.status,
        a.balances,
        a.last_client_id_sequence
      FROM agencies a
      LEFT JOIN users u ON a.manager_user_id = u.id
      ORDER BY a.id ASC
    `;
    const { rows } = await db.query(query);

    const agencies = (rows as any[]).map(agency => ({
      ...agency,
      balances: typeof agency.balances === 'string' ? JSON.parse(agency.balances) : agency.balances,
    }));

    return NextResponse.json(agencies);
  } catch (error) {
    console.error('API Error fetching agencies:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ error: 'Failed to fetch agencies', details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await db.getConnection();
  try {
    const body = await request.json();
    const validation = createAgencySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const { agencyName, agencyAddress, managerName, managerEmail, managerPhone, managerPassword } = validation.data;

    await connection.query('BEGIN');

    const { rows: maxIdResult } = await connection.query('SELECT MAX(CAST(id AS INTEGER)) as "maxId" FROM agencies');
    const maxId = maxIdResult[0]?.maxId || 0;
    const newAgencyId = String(maxId + 1).padStart(2, '0');
    
    const { rows: existingAgency } = await connection.query('SELECT id FROM agencies WHERE name = $1', [agencyName]);
    if (existingAgency.length > 0) {
      throw new Error(`L'agence "${agencyName}" existe déjà.`);
    }
    const { rows: existingManager } = await connection.query('SELECT id FROM users WHERE email = $1 OR phone = $2', [managerEmail, managerPhone]);
    if (existingManager.length > 0) {
      throw new Error('Un manager avec cet email ou téléphone existe déjà.');
    }

    const managerId = randomUUID();
    const passwordHash = await bcrypt.hash(managerPassword, 10);
    
    const managerSequence = '00000001';
    const defaultCountryCode = 'CD';
    const managerWalletId = `${defaultCountryCode}${newAgencyId}${managerSequence}`; 

    const managerUser = {
      id: managerId,
      uid: managerId,
      id_wallet: managerWalletId,
      role: 'Manager',
      status: 'Active',
      full_name: managerName,
      first_name: managerName.split(' ')[0],
      last_name: managerName.split(' ').slice(1).join(' '),
      phone: managerPhone,
      email: managerEmail,
      password_hash: passwordHash,
      created_at: new Date(),
    };
    await connection.query('INSERT INTO users (id, uid, id_wallet, role, status, full_name, first_name, last_name, phone, email, password_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)', Object.values(managerUser));
    
    const managerWallet = {
        id_wallet: managerWalletId,
        user_id: managerId,
        balances: JSON.stringify({ USD: 0, CDF: 0, EUR: 0 }),
        commission_balance: JSON.stringify({ USD: 0 }),
        last_updated: new Date()
    };
    await connection.query('INSERT INTO wallets (id_wallet, user_id, balances, commission_balance, last_updated) VALUES ($1, $2, $3, $4, $5)', Object.values(managerWallet));

    const newAgency = {
        id: newAgencyId,
        name: agencyName,
        address: agencyAddress,
        manager_user_id: managerId,
        balances: JSON.stringify({ USD: 0, CDF: 0, EUR: 0 }),
        last_client_id_sequence: 1,
        status: 'Active',
        created_at: new Date(),
    };
    await connection.query('INSERT INTO agencies (id, name, address, manager_user_id, balances, last_client_id_sequence, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', Object.values(newAgency));

    await connection.query('COMMIT');
    
    return NextResponse.json({ message: 'Agence créée avec succès', agency: newAgency }, { status: 201 });

  } catch (error) {
    await connection.query('ROLLBACK');
    console.error('API Error creating agency:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create agency';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    connection.release();
  }
}
