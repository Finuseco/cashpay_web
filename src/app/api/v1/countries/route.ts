import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  let connection;

  try {
    connection = await db.getConnection();

    const { rows } = await connection.query(`
      SELECT
        code,
        name,
        dial_code AS "dialCode"
      FROM countries_list
      WHERE status = 'Active'
      ORDER BY name ASC
    `);

    return NextResponse.json({
      success: true,
      countries: rows,
    });
  } catch (error) {
    console.error('[API V1 COUNTRIES]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de récupérer la liste des pays.',
      },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
