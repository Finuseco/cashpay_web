

'use client';
import React from 'react';
import { LogOut, LayoutDashboard, ShoppingCart, History, Users, Store, BarChart, Code, Settings, User as UserIcon, Package, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@/lib/types';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from '@/components/ui/navigation-menu';

const navLinks = [
    { href: "/agent/dashboard", label: "Tableau de Bord", icon: LayoutDashboard },
    { href: "/agent/sell", label: "Vente (POS)", icon: ShoppingCart },
    { href: "/agent/orders", label: "Commandes JoJo", icon: Package },
    { href: "/agent/products", label: "Produits", icon: Store },
    { href: "/agent/reports", label: "Rapports", icon: BarChart },
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
                            {navLinks.map((link) => (
                                <NavigationMenuItem key={link.href}>
                                    <Link href={link.href} legacyBehavior passHref>
                                        <NavigationMenuLink
                                            active={pathname.startsWith(link.href)}
                                            className={navigationMenuTriggerStyle()}
                                        >
                                            <link.icon className="mr-2 h-4 w-4" />
                                            {link.label}
                                        </NavigationMenuLink>
                                    </Link>
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                              <Avatar className="h-10 w-10 border-2 border-primary">
                                <AvatarImage src={agent?.profile_photo || undefined} alt={agent?.full_name || "User"} />
                                <AvatarFallback>
                                  {agent?.first_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end">
                            <DropdownMenuLabel>Menu Agent</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                                <span>Espace Client</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/agent/profile')}>
                                <UserIcon className="mr-2 h-4 w-4" />
                                <span>Profil</span>
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => router.push('/marketing/ads')}>
                                <Megaphone className="mr-2 h-4 w-4" />
                                <span>Gestion des publicités</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push('/settings')}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Paramètres</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Déconnexion</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}

    
