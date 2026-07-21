'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
    Loader2, Users, ShoppingBag, CreditCard, LayoutDashboard, LogOut, ArrowLeft, 
    ArrowRightLeft, LifeBuoy, Globe, Tv, Landmark, Wallet, Coins, Briefcase, 
    ChevronDown, ShieldCheck, History, UserPlus, Menu, PackageSearch, Handshake, PiggyBank, Megaphone, Ticket, Plane, Link2
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, 
    DropdownMenuLabel, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

const NavGroup = ({ title, links, pathname }: { title: string, links: any[], pathname: string }) => (
    <div className="space-y-1">
        <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{title}</p>
        {links.map(link => (
            <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    pathname === link.href 
                        ? "bg-primary/10 text-primary" 
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
            >
                <link.icon className="h-4 w-4" />
                <span>{link.label}</span>
            </Link>
        ))}
    </div>
);

export default function SuperAgentLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { openAlert } = useAlertDialog();

    useEffect(() => {
        const checkAuth = async () => {
            const fetchedUser = await getAuthenticatedUser();
            const allowedRoles = ['SuperAgent', 'SubSuperAgent', 'Admin'];
            if (!fetchedUser || !allowedRoles.includes(fetchedUser.role)) {
                openAlert({
                    title: 'Accès Refusé',
                    description: "Vous n'avez pas les droits de gestionnaire pour accéder à cet espace.",
                    variant: 'error',
                    onClose: () => router.replace('/dashboard')
                });
                return;
            }
            setUser(fetchedUser);
            setIsLoading(false);
        };
        checkAuth();
    }, [router, openAlert]);

    const groups = [
        {
            title: "Commandes & Marché",
            links: [
                { href: "/super-agent/orders", label: "Poursuite Commandes", icon: PackageSearch },
                { href: "/super-agent/products", label: "Catalogue JoJo", icon: ShoppingBag },
                { href: "/super-agent/cards", label: "Cartes Physiques", icon: CreditCard },
                { href: "/super-agent/events", label: "Événements Nationaux", icon: Ticket },
                { href: "/super-agent/airlines", label: "Vols Airlines", icon: Plane },
            ]
        },
        {
            title: "Finance & Collecte",
            links: [
                { href: "/super-agent/payment-links", label: "Payment Links", icon: Link2 },
                { href: "/super-agent/loans", label: "Demandes de Prêts", icon: Handshake },
                { href: "/super-agent/dats", label: "Dépôts à Terme (DAT)", icon: PiggyBank },
                { href: "/super-agent/business", label: "B2B & Marchands", icon: Briefcase },
            ]
        },
        {
            title: "Supports (Dépôts)",
            links: [
                { href: "/super-agent/support", label: "Flux Entrants", icon: LifeBuoy },
                { href: "/super-agent/international-claims", label: "Réclames Inter.", icon: Globe },
            ]
        },
        {
            title: "Payouts (Retraits)",
            links: [
                { href: "/super-agent/payouts", label: "Flux Sortants", icon: Landmark },
                { href: "/super-agent/tv-subscriptions", label: "Abonnements TV", icon: Tv },
            ]
        },
        {
            title: "Communication",
            links: [
                { href: "/super-agent/communication", label: "Envoi en masse", icon: Megaphone },
            ]
        },
        {
            title: "Dépenses Cartes",
            links: [
                { href: "/super-agent/card-activity", label: "Visa & MasterCard", icon: Coins },
            ]
        },
        {
            title: "Réseau National",
            links: [
                { href: "/super-agent/users", label: "Utilisateurs", icon: Users },
                { href: "/super-agent/sub-agents", label: "Agents Provinces", icon: UserPlus },
                { href: "/super-agent/rates", label: "Taux de Change", icon: ArrowRightLeft },
            ]
        }
    ];

    if (isLoading) {
        return <div className="flex h-screen w-full items-center justify-center bg-zinc-900"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    const jurisdiction = user.role === 'SubSuperAgent' ? user.province : user.country;
    const subAgentTitle = `Gestionnaire ${jurisdiction}`;

    return (
        <div className="flex min-h-screen bg-zinc-950 text-white">
            <aside className="hidden lg:flex w-64 flex-col border-r border-zinc-800 bg-zinc-900 sticky top-0 h-screen">
                <div className="p-6">
                    <Logo className="w-32" />
                    <div className="mt-4 p-3 bg-zinc-800 rounded-xl border border-zinc-700">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">Ma Zone</p>
                        <p className="text-sm font-bold text-primary truncate">{subAgentTitle}</p>
                    </div>
                </div>
                
                <ScrollArea className="flex-1 px-3">
                    <div className="space-y-6 pb-6">
                        <Link 
                            href="/super-agent/dashboard"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                                pathname === "/super-agent/dashboard" ? "bg-primary text-primary-foreground" : "text-zinc-400 hover:text-white"
                            )}
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            Dashboard
                        </Link>
                        {groups.map(group => (
                            <NavGroup key={group.title} title={group.title} links={group.links} pathname={pathname} />
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-zinc-800">
                    <Button variant="ghost" onClick={() => router.push('/dashboard')} className="w-full justify-start text-zinc-400 hover:text-white">
                        <ArrowLeft className="mr-2 h-4 w-4"/> Retour Client
                    </Button>
                    <Button variant="ghost" onClick={async () => { router.push('/login') }} className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-400/10">
                        <LogOut className="mr-2 h-4 w-4"/> Quitter
                    </Button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
                <header className="lg:hidden h-16 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-4">
                    <Logo className="w-24" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><Menu className="h-6 w-6"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 bg-zinc-900 border-zinc-800 text-white">
                            <DropdownMenuLabel>Menu Gestionnaire</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {groups.flatMap(g => g.links).map(link => (
                                <DropdownMenuItem key={link.href} onClick={() => router.push(link.href)}>
                                    <link.icon className="mr-2 h-4 w-4"/> {link.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </header>

                <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
                    {children}
                </main>
            </div>
        </div>
    );
}