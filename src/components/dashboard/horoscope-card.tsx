'use client';

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getUserHoroscope,
  type AstroPeriod,
  type HoroscopeResult,
} from "@/lib/actions/astro.actions";

type HoroscopeCardProps = {
  userId: number;
  zodiac: HoroscopeResult["zodiac"];
  children: React.ReactNode;
};

type HoroscopePeriod = "daily" | "weekly" | "monthly";

const PERIODS: HoroscopePeriod[] = ["daily", "weekly", "monthly"];

function formatSectionTitle(value: string, language: "fr" | "en") {
  const labels: Record<string, { fr: string; en: string }> = {
    love: { fr: "Amour", en: "Love" },
    work: { fr: "Travail", en: "Work" },
    career: { fr: "Carrière", en: "Career" },
    finance: { fr: "Finances", en: "Finance" },
    health: { fr: "Santé", en: "Health" },
    mood: { fr: "Humeur", en: "Mood" },
    advice: { fr: "Conseil", en: "Advice" },
    general: { fr: "Général", en: "General" },
  };

  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "");
  const found = Object.entries(labels).find(
    ([key]) => key.toLowerCase() === normalized
  );

  if (found) {
    return found[1][language];
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderSectionValue(
  value: unknown,
  language: "fr" | "en"
): React.ReactNode {
  if (typeof value === "string" || typeof value === "number") {
    return (
      <p className="whitespace-pre-line text-[14px] leading-7 text-white/80">
        {String(value)}
      </p>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div key={index}>
            {renderSectionValue(item, language)}
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === "object") {
    return (
      <div className="space-y-4">
        {Object.entries(value as Record<string, unknown>).map(
          ([key, nestedValue]) => (
            <div key={key} className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                {formatSectionTitle(key, language)}
              </h4>
              {renderSectionValue(nestedValue, language)}
            </div>
          )
        )}
      </div>
    );
  }

  return null;
}

function getPeriodLabel(
  period: HoroscopePeriod,
  language: "fr" | "en"
) {
  if (language === "en") {
    return {
      daily: "Today",
      weekly: "This week",
      monthly: "This month",
    }[period];
  }

  return {
    daily: "Aujourd’hui",
    weekly: "Cette semaine",
    monthly: "Ce mois-ci",
  }[period];
}

export function HoroscopeCard({
  userId,
  zodiac,
  children,
}: HoroscopeCardProps) {
  const { i18n } = useTranslation();
  const language: "fr" | "en" = i18n.language
    ?.toLowerCase()
    .startsWith("en")
    ? "en"
    : "fr";

  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<HoroscopePeriod>("daily");
  const [horoscope, setHoroscope] = useState<HoroscopeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadHoroscope = async () => {
      try {
        setLoading(true);
        setError(false);

        const result = await getUserHoroscope(
          userId,
          period as AstroPeriod,
          language
        );

        if (!cancelled) {
          setHoroscope(result);
        }
      } catch (err) {
        console.error("[HoroscopeCard] Failed to load horoscope:", err);

        if (!cancelled) {
          setHoroscope(null);
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadHoroscope();

    return () => {
      cancelled = true;
    };
  }, [open, period, userId, language]);

  const sections = useMemo(() => {
    if (!horoscope?.sections) return [];

    return Object.entries(horoscope.sections);
  }, [horoscope]);

  const zodiacName =
    language === "en" ? zodiac.nameEn : zodiac.nameFr;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-left transition-all duration-300 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={
          language === "en"
            ? `Open horoscope for ${zodiacName}`
            : `Ouvrir l’horoscope de ${zodiacName}`
        }
      >
        {children}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="
            max-w-[680px]
            overflow-hidden
            border-white/10
            bg-[#070914]
            p-0
            text-white
            shadow-[0_30px_100px_rgba(0,0,0,0.65)]
            sm:rounded-[30px]
          "
        >
          <div className="relative max-h-[88vh] overflow-hidden">
            {/* Animated celestial background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl animate-pulse" />
              <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl animate-pulse" />

              <div className="absolute left-[12%] top-[18%] h-1 w-1 rounded-full bg-white/80 shadow-[0_0_12px_4px_rgba(255,255,255,0.45)] animate-pulse" />
              <div className="absolute left-[78%] top-[14%] h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_15px_5px_rgba(255,255,255,0.35)] animate-pulse" />
              <div className="absolute left-[88%] top-[44%] h-1 w-1 rounded-full bg-violet-200/80 shadow-[0_0_14px_4px_rgba(196,181,253,0.5)] animate-pulse" />
              <div className="absolute left-[18%] top-[62%] h-1.5 w-1.5 rounded-full bg-indigo-200/70 shadow-[0_0_15px_5px_rgba(165,180,252,0.35)] animate-pulse" />
              <div className="absolute left-[72%] bottom-[14%] h-1 w-1 rounded-full bg-white/70 shadow-[0_0_12px_4px_rgba(255,255,255,0.35)] animate-pulse" />

              <div className="absolute left-1/2 top-28 h-64 w-64 -translate-x-1/2 rounded-full border border-white/[0.035] animate-[spin_35s_linear_infinite]" />
              <div className="absolute left-1/2 top-28 h-80 w-80 -translate-x-1/2 rounded-full border border-violet-300/[0.025] animate-[spin_50s_linear_infinite_reverse]" />
            </div>

            <div className="relative flex max-h-[88vh] flex-col">
              {/* Header */}
              <div className="border-b border-white/[0.08] px-5 pb-4 pt-6 sm:px-7">
                <div className="flex items-start gap-4">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-3xl shadow-[0_0_35px_rgba(139,92,246,0.18)]">
                    <span className="relative z-10">{zodiac.symbol}</span>
                    <span className="absolute inset-0 rounded-2xl bg-violet-500/10 blur-xl" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                      {language === "en"
                        ? "Your Horoscope"
                        : "Votre horoscope"}
                    </DialogTitle>

                    <p className="mt-1 text-sm text-white/50">
                      {zodiacName}
                    </p>
                  </div>
                </div>

                {/* Period selector */}
                <div className="mt-5 grid grid-cols-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-1">
                  {PERIODS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPeriod(item)}
                      className={[
                        "relative rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-300 sm:text-sm",
                        period === item
                          ? "bg-white/[0.10] text-white shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                          : "text-white/40 hover:bg-white/[0.05] hover:text-white/70",
                      ].join(" ")}
                    >
                      {period === item && (
                        <span className="absolute inset-0 rounded-xl bg-violet-500/10" />
                      )}
                      <span className="relative">
                        {getPeriodLabel(item, language)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                {loading ? (
                  <div className="space-y-5 py-6">
                    <div className="h-5 w-2/5 animate-pulse rounded-full bg-white/10" />
                    <div className="space-y-3">
                      <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.07]" />
                      <div className="h-3 w-[92%] animate-pulse rounded-full bg-white/[0.07]" />
                      <div className="h-3 w-[80%] animate-pulse rounded-full bg-white/[0.07]" />
                    </div>
                    <div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />
                  </div>
                ) : error ? (
                  <div className="flex min-h-48 items-center justify-center text-center">
                    <p className="max-w-sm text-sm leading-6 text-white/50">
                      {language === "en"
                        ? "The horoscope could not be loaded right now."
                        : "L’horoscope ne peut pas être chargé pour le moment."}
                    </p>
                  </div>
                ) : horoscope ? (
                  <div className="space-y-6">
                    {horoscope.title && (
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300/60">
                          {getPeriodLabel(period, language)}
                        </p>
                        <h3 className="text-lg font-semibold leading-7 text-white">
                          {horoscope.title}
                        </h3>
                      </div>
                    )}

                    {sections.length > 0 ? (
                      <div className="space-y-4">
                        {sections.map(([key, value]) => (
                          <section
                            key={key}
                            className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 backdrop-blur-sm transition-colors duration-300 hover:bg-white/[0.05]"
                          >
                            <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-violet-200/70">
                              {formatSectionTitle(key, language)}
                            </h4>

                            {renderSectionValue(value, language)}
                          </section>
                        ))}
                      </div>
                    ) : horoscope.text ? (
                      <article className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
                        <p className="whitespace-pre-line text-[15px] leading-8 text-white/80">
                          {horoscope.text}
                        </p>
                      </article>
                    ) : null}

                    {horoscope.attribution?.localizedHref && (
                      <div className="border-t border-white/[0.07] pt-4 text-center">
                        <a
                          href={horoscope.attribution.localizedHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white/35 transition-colors hover:text-white/60"
                        >
                          {horoscope.attribution.text || "Powered by Sigastra"}
                        </a>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
