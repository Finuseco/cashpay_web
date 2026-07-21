
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plane, Disc, Sparkles, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const SoccerBallIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15.6 6.4-1.2 1.2-1.2-1.2-1.2 1.2-1.2-1.2-1.2 1.2-1.2-1.2-1.2 1.2-1.2-1.2" />
      <path d="M12 12a4.2 4.2 0 0 0-4.2-4.2H6.4" />
      <path d="M12 12a4.2 4.2 0 0 1 4.2 4.2v1.4" />
      <path d="M12 12a4.2 4.2 0 0 0 4.2-4.2V6.4" />
      <path d="M12 12a4.2 4.2 0 0 1-4.2 4.2H6.4" />
    </svg>
);



export function SportsCategoryNav() {
    const { t } = useTranslation();
    const sports = [
        { name: t('sportsCategoryFootball'), icon: <SoccerBallIcon className="h-6 w-6"/> },
        { name: t('casinoGameAviator'), icon: <Plane className="h-6 w-6"/> },
        { name: t('sportsCategorySpin'), icon: <Disc className="h-6 w-6" /> },
        { name: t('lottoTitle'), icon: <Ticket className="h-6 w-6" /> },
        { name: t('sportsCategoryCasino'), icon: <Sparkles className="h-6 w-6" /> },
    ];
    return (
        <div className="flex justify-around items-start text-center px-2">
            {sports.map((sport) => (
                <button 
                    key={sport.name} 
                    className="flex flex-col items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white"
                >
                    <div className="h-8 flex items-center justify-center">
                        {sport.icon}
                    </div>
                    <span>{sport.name}</span>
                </button>
            ))}
        </div>
    );
}
