
'use server';

import type { Province } from '@/lib/types';
import { PROVINCES_BY_COUNTRY } from '@/lib/provinces';

export async function getProvincesByCountry(countryCode: string): Promise<Province[]> {
  const provinceNames = PROVINCES_BY_COUNTRY[countryCode.toUpperCase() as keyof typeof PROVINCES_BY_COUNTRY] || [];
  return provinceNames.map(name => ({ code: name, name: name }));
}
