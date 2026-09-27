'use server';

import { db } from '@/lib/db';

export type AstroPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

export type ZodiacSign = {
  key:
    | 'aries'
    | 'taurus'
    | 'gemini'
    | 'cancer'
    | 'leo'
    | 'virgo'
    | 'libra'
    | 'scorpio'
    | 'sagittarius'
    | 'capricorn'
    | 'aquarius'
    | 'pisces';
  symbol: string;
  nameFr: string;
  nameEn: string;
};

export type HoroscopeCategories = {
  love: string;
  work: string;
  finance: string;
  mood: string;
};

export type AstroProfile = {
  userId: number;
  birthDate: string;
  zodiac: ZodiacSign;
};

export type HoroscopeResult = {
  userId: number;
  birthDate: string;
  zodiac: ZodiacSign;
  period: AstroPeriod;
  categories: HoroscopeCategories;
  title?: string;
  text?: string;
  sections?: Record<string, unknown>;
  attribution?: {
    text: string;
    localizedHref: string;
  };
};

const ZODIAC_SIGNS: ZodiacSign[] = [
  {
    key: 'aries',
    symbol: '♈',
    nameFr: 'Bélier',
    nameEn: 'Aries',
  },
  {
    key: 'taurus',
    symbol: '♉',
    nameFr: 'Taureau',
    nameEn: 'Taurus',
  },
  {
    key: 'gemini',
    symbol: '♊',
    nameFr: 'Gémeaux',
    nameEn: 'Gemini',
  },
  {
    key: 'cancer',
    symbol: '♋',
    nameFr: 'Cancer',
    nameEn: 'Cancer',
  },
  {
    key: 'leo',
    symbol: '♌',
    nameFr: 'Lion',
    nameEn: 'Leo',
  },
  {
    key: 'virgo',
    symbol: '♍',
    nameFr: 'Vierge',
    nameEn: 'Virgo',
  },
  {
    key: 'libra',
    symbol: '♎',
    nameFr: 'Balance',
    nameEn: 'Libra',
  },
  {
    key: 'scorpio',
    symbol: '♏',
    nameFr: 'Scorpion',
    nameEn: 'Scorpio',
  },
  {
    key: 'sagittarius',
    symbol: '♐',
    nameFr: 'Sagittaire',
    nameEn: 'Sagittarius',
  },
  {
    key: 'capricorn',
    symbol: '♑',
    nameFr: 'Capricorne',
    nameEn: 'Capricorn',
  },
  {
    key: 'aquarius',
    symbol: '♒',
    nameFr: 'Verseau',
    nameEn: 'Aquarius',
  },
  {
    key: 'pisces',
    symbol: '♓',
    nameFr: 'Poissons',
    nameEn: 'Pisces',
  },
];

function parseBirthDate(value: string | Date): {
  month: number;
  day: number;
  iso: string;
} {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Date de naissance invalide.');
    }

    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;
    const day = value.getUTCDate();

    return {
      month,
      day,
      iso: `${year.toString().padStart(4, '0')}-${month
        .toString()
        .padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
    };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error('Date de naissance invalide.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const check = new Date(Date.UTC(year, month - 1, day));

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    throw new Error('Date de naissance invalide.');
  }

  return { month, day, iso: value };
}

function getZodiacSign(month: number, day: number): ZodiacSign {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) {
    return ZODIAC_SIGNS[0];
  }

  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) {
    return ZODIAC_SIGNS[1];
  }

  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) {
    return ZODIAC_SIGNS[2];
  }

  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) {
    return ZODIAC_SIGNS[3];
  }

  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) {
    return ZODIAC_SIGNS[4];
  }

  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) {
    return ZODIAC_SIGNS[5];
  }

  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) {
    return ZODIAC_SIGNS[6];
  }

  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) {
    return ZODIAC_SIGNS[7];
  }

  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) {
    return ZODIAC_SIGNS[8];
  }

  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
    return ZODIAC_SIGNS[9];
  }

  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) {
    return ZODIAC_SIGNS[10];
  }

  return ZODIAC_SIGNS[11];
}

export async function getZodiacSignForBirthDate(
  birthDate: string | Date
): ZodiacSign {
  const parsed = parseBirthDate(birthDate);
  return getZodiacSign(parsed.month, parsed.day);
}

export async function getUserAstroProfile(
  userId: number
): Promise<AstroProfile> {
  const result = await db.query(
    `
      SELECT id, birth_date
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  if (!result.rows.length) {
    throw new Error('Utilisateur introuvable.');
  }

  const user = result.rows[0];

  if (!user.birth_date) {
    throw new Error('Date de naissance non renseignée.');
  }

  const parsed = parseBirthDate(user.birth_date);
  const zodiac = getZodiacSign(parsed.month, parsed.day);

  return {
    userId: Number(user.id),
    birthDate: parsed.iso,
    zodiac,
  };
}

type SigastraResponse = {
  items?: Array<{
    title?: string;
    text?: string;
    sections?: Record<string, unknown>;
  }>;
  attribution?: {
    text?: string;
    localizedHref?: string;
  };
};

async function getSigastraHoroscope(
  zodiac: ZodiacSign,
  period: 'daily' | 'weekly' | 'monthly',
  language: 'fr' | 'en'
): Promise<{
  title?: string;
  text: string;
  sections?: Record<string, unknown>;
  attribution?: {
    text: string;
    localizedHref: string;
  };
}> {
  const url = new URL(`https://sigastra.com/api/v1/${period}`);
  url.searchParams.set('lang', language);
  url.searchParams.set('sign', zodiac.key);
  url.searchParams.set('full', '1');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
    next: {
      revalidate: 3600,
    },
  });

  if (!response.ok) {
    throw new Error(`Sigastra API error: ${response.status}`);
  }

  const data = (await response.json()) as SigastraResponse;
  const item = data.items?.[0];

  if (!item?.text) {
    throw new Error('Réponse Sigastra invalide.');
  }

  return {
    title: item.title,
    text: item.text,
    sections: item.sections,
    attribution:
      data.attribution?.text && data.attribution.localizedHref
        ? {
            text: data.attribution.text,
            localizedHref: data.attribution.localizedHref,
          }
        : undefined,
  };
}

/**
 * Contrat interne du moteur horoscope.
 *
 * Les textes sont volontairement courts pour permettre plus tard
 * le remplacement de cette fonction par un fournisseur externe
 * sans modifier le calcul du signe ni les données utilisateur.
 */
function getLocalHoroscope(
  zodiac: ZodiacSign,
  period: AstroPeriod
): HoroscopeCategories {
  const periodLabel: Record<AstroPeriod, string> = {
    daily: 'aujourd’hui',
    weekly: 'cette semaine',
    monthly: 'ce mois-ci',
    quarterly: 'ce trimestre',
    annual: 'cette année',
  };

  return {
    love: `${zodiac.nameFr}, ${periodLabel[period]}, privilégiez l’écoute et la sincérité dans vos relations.`,
    work: `${zodiac.nameFr}, ${periodLabel[period]}, avancez avec méthode et concentrez-vous sur vos priorités.`,
    finance: `${zodiac.nameFr}, ${periodLabel[period]}, gardez une vision claire de vos dépenses et de vos objectifs.`,
    mood: `${zodiac.nameFr}, ${periodLabel[period]}, accordez-vous du temps pour préserver votre équilibre.`,
  };
}

export async function getUserHoroscope(
  userId: number,
  period: AstroPeriod = 'daily',
  language: 'fr' | 'en' = 'fr'
): Promise<HoroscopeResult> {
  const validPeriods: AstroPeriod[] = [
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'annual',
  ];

  if (!validPeriods.includes(period)) {
    throw new Error('Période horoscope invalide.');
  }

  const profile = await getUserAstroProfile(userId);
  const categories = getLocalHoroscope(profile.zodiac, period);

  if (
    period !== 'daily' &&
    period !== 'weekly' &&
    period !== 'monthly'
  ) {
    return {
      userId: profile.userId,
      birthDate: profile.birthDate,
      zodiac: profile.zodiac,
      period,
      categories,
    };
  }

  try {
    const sigastra = await getSigastraHoroscope(
      profile.zodiac,
      period,
      language === 'en' ? 'en' : 'fr'
    );

    return {
      userId: profile.userId,
      birthDate: profile.birthDate,
      zodiac: profile.zodiac,
      period,
      categories,
      title: sigastra.title,
      text: sigastra.text,
      sections: sigastra.sections,
      attribution: sigastra.attribution,
    };
  } catch (error) {
    console.error('[Astro] Sigastra unavailable:', error);

    return {
      userId: profile.userId,
      birthDate: profile.birthDate,
      zodiac: profile.zodiac,
      period,
      categories,
    };
  }
}

export async function getAllZodiacSigns(): Promise<ZodiacSign[]> {
  return ZODIAC_SIGNS;
}
