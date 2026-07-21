
'use client';

import {
  Heart, BarChart2, MessageSquare, Users, Video, Store, Flag, Bookmark, Clock, Gift, Ticket, BadgeCheck, Settings, UserCircle, LogOut, ChevronLeft, Search, Radio, Rss, NotebookText, Plane, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const MenuItem = ({ icon: Icon, label, href }: { icon: React.ElementType, label: string, href: string }) => (
    <Link href={href} className="bg-zinc-800 rounded-lg p-3 flex flex-col items-start justify-between h-24 hover:bg-zinc-700 transition-colors">
        <Icon className="h-6 w-6 text-white" />
        <span className="font-semibold text-sm">{label}</span>
    </Link>
);

export default function MonPaysMenuPage() {
    const router = useRouter();
    return (
        <div className="bg-zinc-900 min-h-screen text-white">
            <header className="flex items-center p-2">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft />
                </Button>
                <h1 className="text-xl font-bold ml-2">Menu</h1>
                 <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="rounded-full bg-zinc-700 hover:bg-zinc-600">
                        <Search />
                    </Button>
                </div>
            </header>
            <main className="p-4 space-y-4">
                <div className="p-4 bg-zinc-800 rounded-lg">
                    <h2 className="text-xl font-bold">MonPays</h2>
                    <p className="text-sm text-zinc-400">Raccourcis vers vos services préférés</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <MenuItem icon={BarChart3} label="Analytiques" href="/monpays/analytics" />
                    <MenuItem icon={MessageSquare} label="OnChat" href="/feedback" />
                    <MenuItem icon={Users} label="Groupes" href="/feedback?view=groups" />
                    <MenuItem icon={Video} label="Vidéos" href="/monpays/videos" />
                    <MenuItem icon={Store} label="JoJo Shopping" href="/shopping" />
                    <MenuItem icon={Flag} label="Mes Pages" href="/monpays/company/manage" />
                    <MenuItem icon={Clock} label="Souvenirs" href="#" />
                    <MenuItem icon={Gift} label="Annonces" href="/marketing/ads" />
                    <MenuItem icon={Ticket} label="Évènements" href="/events" />
                    <MenuItem icon={Rss} label="Actualités" href="/news" />
                    <MenuItem icon={NotebookText} label="Chèques" href="/checks" />
                    <MenuItem icon={Plane} label="Vols Airline" href="/flights" />
                    <MenuItem icon={Settings} label="Paramètres" href="/settings" />
                    <MenuItem icon={UserCircle} label="Profil" href="/profile" />
                </div>
            </main>
        </div>
    );
}
