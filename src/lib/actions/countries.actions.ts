'use server';

import { countries } from '@/lib/countries'; // Import from the local file
import type { Country } from '@/lib/types';

export async function getCountriesList(): Promise<Country[]> {
    // Return the static list directly. This is much faster and more reliable
    // for data that doesn't change often.
    return countries;
}
