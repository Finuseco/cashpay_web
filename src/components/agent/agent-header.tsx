

'use client';
import React from 'react';
import { LogOut, LayoutDashboard, ShoppingCart, History, Users, Store, BarChart, Code, Settings, User as UserIcon, Package, Megaphone, ArrowDownToLine, ArrowUpFromLine, ChevronDown, Percent, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import {
    ActionPanel,
    ActionPanelContent,
    ActionPanelItem,
    ActionPanelLabel,
    ActionPanelSeparator,
    ActionPanelTrigger,
    ActionPanelGroup,
} from "@/components/ui/action-panel"
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@/lib/types';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from '@/components/ui/navigation-menu';

// Liens principaux visibles dans la barre
const primaryNavLinks = [
    { href: "/agent/dashboard", label: "Accueil", icon: LayoutDashboard },
    { href: "/agent/sell", label: "Vente POS", icon: ShoppingCart },
    { href: "/agent/orders", label: "Commandes", icon: Package },
    { href: "/agent/products", label: "Produits", icon: Store },
    { href: "/agent/boutiques", label: "Boutiques", icon: Store },
];

// Liens supplémentaires dans le menu "Plus"
const moreNavLinks = [
    { href: "/agent/deposit", label: "Dépôt Client", icon: ArrowDownToLine },
    { href: "/agent/withdraw", label: "Retrait Client", icon: ArrowUpFromLine },
    { href: "/agent/commissions", label: "Commissions", icon: Percent },
    { href: "/agent/clients", label: "Clients", icon: Users },
    { href: "/agent/reports", label: "Rapports", icon: BarChart },
    { href: "/agent/history", label: "Historique", icon: History },
    { href: "/agent/mobile-money-withdrawal", label: "Retrait Mobile", icon: Banknote },
    { href: "/agent/marketing", label: "Marketing", icon: Megaphone },
    { href: "/agent/developer", label: "Développeur", icon: Code },
];

export function AgentHeader({ agent }: { agent?: User | null }) {
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = () => {
        // Clear both localStorage and the auth cookie
        localStorage.removeItem('session');
        // This part needs a server action if the cookie is httpOnly
        router.push('/login'); 
    };

    return (
        <header className="bg-background text-foreground sticky top-0 z-40 border-b">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <Logo className="w-32" />
                </div>
                <div className="hidden md:flex flex-grow justify-center">
                   <NavigationMenu>
                        <NavigationMenuList>
                            {primaryNavLinks.map((link) => (
                                <NavigationMenuItem key={link.href}>
                                    <Link href={link.href} legacyBehavior passHref>
                                        <NavigationMenuLink
                                            active={pathname === link.href || (link.href !== '/agent/dashboard' && pathname.startsWith(link.href))}
                                            className={navigationMenuTriggerStyle()}
                                        >
                                            <link.icon className="mr-1.5 h-4 w-4" />
                                            {link.label}
                                        </NavigationMenuLink>
                                    </Link>
                                </NavigationMenuItem>
                            ))}
                            {/* Menu "Plus" pour les liens additionnels */}
                            <NavigationMenuItem>
                                <ActionPanel>
                                    <ActionPanelTrigger asChild>
                                        <button className={cn(navigationMenuTriggerStyle(), "flex items-center gap-1")}>
                                            Plus <ChevronDown className="h-3 w-3" />
                                        </button>
                                    </ActionPanelTrigger>
                                    <ActionPanelContent className="w-52" align="center">
                                        <ActionPanelGroup>
                                            {moreNavLinks.map((link) => (
                                                <ActionPanelItem key={link.href} onClick={() => router.push(link.href)} className={cn(pathname.startsWith(link.href) && "bg-accent")}>
                                                    <link.icon className="mr-2 h-4 w-4" />
                                                    {link.label}
                                                </ActionPanelItem>
                                            ))}
                                        </ActionPanelGroup>
                                    </ActionPanelContent>
                                </ActionPanel>
                            </NavigationMenuItem>
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <ActionPanel>
                        <ActionPanelTrigger asChild>
                           <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                              <Avatar className="h-10 w-10 border-2 border-primary">
                                <AvatarImage src={agent?.profile_photo || undefined} alt={agent?.full_name || "User"} />
                                <AvatarFallback>
                                  {agent?.first_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            </Button>
                        </ActionPanelTrigger>
                        <ActionPanelContent className="w-56" align="end">
                            <ActionPanelLabel>Menu Agent</ActionPanelLabel>
                            <ActionPanelSeparator />
                             <ActionPanelItem onClick={() => router.push('/dashboard')}>
                                <span>Espace Client</span>
                            </ActionPanelItem>
                            <ActionPanelItem onClick={() => router.push('/agent/profile')}>
                                <UserIcon className="mr-2 h-4 w-4" />
                                <span>Profil</span>
                            </ActionPanelItem>
                             <ActionPanelItem onClick={() => router.push('/marketing/ads')}>
                                <Megaphone className="mr-2 h-4 w-4" />
                                <span>Gestion des publicités</span>
                            </ActionPanelItem>
                            <ActionPanelItem onClick={() => router.push('/settings')}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Paramètres</span>
                            </ActionPanelItem>
                            <ActionPanelSeparator />
                            <ActionPanelItem onClick={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Déconnexion</span>
                            </ActionPanelItem>
                        </ActionPanelContent>
                    </ActionPanel>
                </div>
            </div>
        </header>
    );
}

    
