import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const servantSchema = z.object({
  matricule: z.string().min(3, "Le matricule est requis."),
  nom_complet: z.string().min(5, "Le nom complet est requis."),
  ministere: z.string().min(3, "Le ministère est requis."),
  fonction: z.string().min(3, "La fonction est requise."),
  id_wallet: z.string().min(12, "Le format du Wallet ID est invalide."),
  statut: z.enum(['actif', 'suspendu']),
  baseSalary: z.coerce.number().positive("Le salaire de base est requis."),
  currency: z.enum(['USD', 'CDF', 'EUR']),
});

export async function GET() {
  try {
    const { rows } = await db.query('SELECT *, id_fonc as id FROM fonctionnaires ORDER BY nom_complet ASC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('API Error fetching civil servants:', error);
    return NextResponse.json({ error: 'Failed to fetch civil servants' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = servantSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }
    const data = validation.data;
    
    // Prepare object for insertion
    const servantForDb = {
      id_fonc: `fonc_${randomUUID()}`,
      matricule: data.matricule,
      nom_complet: data.nom_complet,
      ministere: data.ministere,
      fonction: data.fonction,
      id_wallet: data.id_wallet,
      statut: data.statut,
      base_salary: data.baseSalary,
      salary_currency: data.currency,
    };

    await db.query('INSERT INTO fonctionnaires (id_fonc, matricule, nom_complet, ministere, fonction, id_wallet, statut, base_salary, salary_currency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', Object.values(servantForDb));
    return NextResponse.json({id: servantForDb.id_fonc, ...data}, { status: 201 });
  } catch (error) {
    console.error('API Error creating civil servant:', error);
    if (error instanceof Error && 'code' in error && (error as any).code === '23505') { // 23505 is PostgreSQL's unique_violation
        return NextResponse.json({ error: 'Un fonctionnaire avec ce matricule ou ce Wallet ID existe déjà.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create civil servant' }, { status: 500 });
  }
}
