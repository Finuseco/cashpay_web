
"use client";

import { SportsFilterBar } from "./sports-filter-bar";
import { SportsCategoryNav } from "./sports-category-nav";
import { LeagueAccordion } from "./league-accordion";
import type { SportsEvent } from "@/lib/types";
import Image from "next/image";

export function SportsClient({ events }: { events: SportsEvent[] }) {

  const groupedEvents = events.reduce((acc, event) => {
    const groupKey = event.category.id;
    if (!acc[groupKey]) {
        acc[groupKey] = {
            countryName: event.category.parent?.name || 'International',
            leagueName: event.category.name,
            events: []
        };
    }
    acc[groupKey].events.push(event);
    return acc;
  }, {} as Record<string, { countryName: string; leagueName: string; events: SportsEvent[] }>);


  return (
    <div className="space-y-4 pb-20 bg-zinc-900 text-white">
      <div className="sticky top-0 bg-[#1e293b] py-2 z-10 shadow-md">
        <SportsCategoryNav />
      </div>
      <div className="px-2 space-y-3">
        <SportsFilterBar />

        {/* Jackpot Banner */}
        <div className="relative rounded-lg overflow-hidden text-white">
            <Image src="https://placehold.co/600x120.png" width={600} height={120} alt="Jackpot Banner" className="w-full" data-ai-hint="jackpot win"/>
            <div className="absolute inset-0 bg-black/30 p-4 flex flex-col justify-center">
                <p className="text-xl font-bold">Un Jackpot de 50.000.000 FC</p>
                <p>Désormais à 400FC seulement</p>
            </div>
        </div>

        <div className="flex justify-between items-center px-2 py-1 text-xs text-zinc-400">
            <span>Équipes</span>
            <div className="flex gap-8">
                <span>1</span>
                <span>X</span>
                <span>2</span>
            </div>
        </div>

        {Object.values(groupedEvents).map(group => (
            <LeagueAccordion 
                key={group.leagueName} 
                leagueName={group.leagueName}
                countryName={group.countryName}
                events={group.events} 
            />
        ))}
      </div>
    </div>
  );
}
