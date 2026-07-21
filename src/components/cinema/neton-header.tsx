
"use client";

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Search, Download, Plus } from "lucide-react";
import { NetOnLogo } from "./neton-logo";

export function NetOnHeader() {
  const { t } = useTranslation();

  return (
    <header className="bg-black/80 backdrop-blur-sm text-zinc-100 sticky top-0 z-20">
      <div className="container mx-auto flex h-16 items-center justify-between px-2 md:px-6">
        <div className="flex items-center gap-4">
            <NetOnLogo className="text-3xl text-red-600 hidden md:block" />
             <div className="flex items-center gap-1">
                <Button variant="ghost" asChild className="text-sm font-semibold text-white">
                    <Link href="/cinema">Séries</Link>
                </Button>
                 <Button variant="ghost" asChild className="text-sm font-semibold text-white">
                    <Link href="/cinema">Films</Link>
                </Button>
                 <Button variant="ghost" asChild className="text-sm font-semibold text-white">
                    <Link href="/cinema/categories">Catégories</Link>
                </Button>
            </div>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 md:hidden">
            <NetOnLogo className="text-3xl text-red-600" />
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
            <Button variant="ghost" size="icon"><Search /></Button>
            <Button variant="ghost" size="icon"><Plus className="h-5 w-5"/> <span className="sr-only">Ma liste</span></Button>
            <Button variant="ghost" size="icon" asChild><Link href="/cinema/downloads"><Download /></Link></Button>
        </div>
      </div>
    </header>
  );
}
