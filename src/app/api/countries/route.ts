
import { NextResponse } from 'next/server';
import { getCountriesList } from '@/lib/actions/countries.actions';

export async function GET() {
  const countries = await getCountriesList();
  return NextResponse.json(countries);
}
