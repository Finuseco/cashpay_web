'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, MessageSquare, User, Plus, Send, Repeat, ArrowDown, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NavItem = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  return (
     <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full text-sm font-medium transition-colors",
        isActive
          ? "text-yellow-400"
          : "text-zinc-400 hover:text-yellow-400"
      )}
    >
      <Icon className="h-6 w-6 mb-1" />
      <span className="text-xs">{label}</span>
    </Link>
  );
};

const ActionShortcut = ({ href, icon: Icon, label }: { href: string, icon: React.ElementType, label: string }) => (
    <Link href={href} className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-zinc-700/50 text-center">
        <Icon className="h-8 w-8 text-yellow-400" />
        <span className="text-sm font-semibold">{label}</span>
    </Link>
)

export function AfriCoinFooter() {
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const footerNavItems = [
        { href: "/africoin", icon: Home, label: 'Accueil' },
        { href: "/africoin/market", icon: Compass, label: 'Marché' },
        { href: "/africoin/chat", icon: MessageSquare, label: 'Chat' },
        { href: "/profile", icon: User, label: 'Profil' },
    ];
    
    const leftItems = footerNavItems.slice(0, 2);
    const rightItems = footerNavItems.slice(2, 4);

    return (
        <footer className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t bg-zinc-900/95 border-zinc-800 backdrop-blur-sm">
            <div className="relative">
                <nav className="flex items-center h-16">
                    <div className="flex w-2/5 justify-around">
                        {leftItems.map((item) => (
                            <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
                        ))}
                    </div>

                    <div className="w-1/5 flex justify-center">
                         <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                            <SheetTrigger asChild>
                                 <Button 
                                    aria-label="New Action"
                                    className="relative flex items-center justify-center h-16 w-16 bg-yellow-400 text-black rounded-full shadow-lg transform -translate-y-1/2 border-4 border-zinc-900 hover:bg-yellow-500"
                                 >
                                    <Plus className="h-8 w-8" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="rounded-t-2xl bg-zinc-900 border-zinc-700 text-white">
                                <SheetHeader className="mb-6">
                                    <SheetTitle className="text-center">Raccourcis</SheetTitle>
                                </SheetHeader>
                                 <div className="grid grid-cols-2 gap-4">
                                    <ActionShortcut href="/africoin/send" icon={Send} label="Envoyer" />
                                    <ActionShortcut href="/africoin/receive" icon={ArrowDown} label="Recevoir" />
                                    <ActionShortcut href="/africoin/exchange" icon={Repeat} label="Échanger" />
                                    <ActionShortcut href="/africoin/buy" icon={ShoppingBag} label="Acheter" />
                                 </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <div className="flex w-2/5 justify-around">
                        {rightItems.map((item) => (
                            <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
                        ))}
                    </div>
                </nav>
            </div>
        </footer>
    );
}
