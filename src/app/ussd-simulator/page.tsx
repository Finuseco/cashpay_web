"use client";

import { UssdSimulator } from "@/components/ussd/ussd-simulator";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function UssdSimulatorPage() {
  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-900">
        <header className="absolute top-0 left-0 p-4 z-10">
            <Button asChild variant="outline" className="text-white border-white/50 bg-black/30 hover:bg-black/50">
                <Link href="/settings">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour aux paramètres
                </Link>
            </Button>
        </header>
        <main className="flex flex-1 items-center justify-center p-4">
            <UssdSimulator />
        </main>
    </div>
  );
}
