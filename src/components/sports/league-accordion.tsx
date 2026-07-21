
"use client";

import { MatchOddsCard } from "./match-odds-card";
import type { SportsEvent } from "@/lib/types";

interface LeagueAccordionProps {
  leagueName: string;
  countryName: string;
  events: SportsEvent[];
}

export function LeagueAccordion({ leagueName, countryName, events }: LeagueAccordionProps) {
  if (!events || events.length === 0) {
    return null;
  }
  
  return (
     <div className="space-y-2">
        {events.map((event) => (
          <MatchOddsCard key={event.id} event={event} />
        ))}
    </div>
  );
}
