
'use client';
import { Button } from "@/components/ui/button";
import { Filter, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function SportsFilterBar() {
  const { t } = useTranslation();
  
  const tabs = [t('sportsFilterFeatured'), t('sportsFilterNext'), t('sportsFilterCountries')];
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div className="space-y-3">
        <div className="flex items-center border-b border-zinc-700">
            {tabs.map(tab => (
                <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                        "px-4 py-2 text-sm font-semibold transition-colors",
                        activeTab === tab ? "text-yellow-400 border-b-2 border-yellow-400" : "text-zinc-400"
                    )}
                >
                    {tab}
                </button>
            ))}
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-sm h-8 rounded-full">
                <Filter className="w-3 h-3 mr-2"/>
                {t('sportsFilterFilters')}
            </Button>
             <Button variant="outline" className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-sm h-8 rounded-full">
                {t('today')}
                <ChevronDown className="w-4 h-4 ml-1"/>
            </Button>
        </div>
    </div>
  );
}
