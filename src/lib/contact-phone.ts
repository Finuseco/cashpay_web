import { countries } from './countries';

/** Full international identity: never match unrelated countries by a suffix. */
export function contactPhone(raw: string, country: string | null | undefined): string | null {
  const clean = raw.trim();
  if (!/^[+\d\s().-]+$/.test(clean)) return null;
  const digits = clean.replace(/\D/g, '');
  if (clean.startsWith('+') || clean.startsWith('00')) {
    const international = clean.startsWith('00') ? digits.slice(2) : digits;
    return /^[1-9]\d{6,14}$/.test(international) ? international : null;
  }
  const region = countries.find(c => c.code.toLowerCase() === String(country).toLowerCase() || c.name.toLowerCase() === String(country).toLowerCase());
  if (!region) return null;
  const dial = region.dial_code.replace(/\D/g, '');
  const national = region.code === 'IT' ? digits : digits.replace(/^0/, '');
  const result = digits.startsWith(dial) && digits.length >= dial.length + 6 ? digits : dial + national;
  return /^[1-9]\d{6,14}$/.test(result) ? result : null;
}

export function contactCandidates(international: string, _country?: string | null): string[] {
  const candidates = new Set([international, '00' + international]);
  // A contact abroad may have a national-form number stored on its account.
  // Generate candidates broadly, then validate every result against its own country.
  for (const region of countries) {
    const dial = region.dial_code.replace(/\D/g, '');
    if (dial && international.startsWith(dial)) {
      const national = international.slice(dial.length);
      if (national.length >= 6) { candidates.add(national); candidates.add('0' + national); }
    }
  }
  return [...candidates];
}
