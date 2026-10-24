
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Package, Store, MoreHorizontal, Users, History, User, ArrowDownToLine, ArrowUpFromLine, Percent, Banknote, BarChart, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NavItem = ({ href, icon: Icon, label, onClick }: { href: string; icon: React.ElementType; label: string; onClick?: () => void }) => {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/agent/dashboard' && pathname.startsWith(href));

  return (
     <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full text-sm font-medium transition-colors",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-primary"
      )}
    >
      <Icon className="h-6 w-6 mb-1" />
      <span className="text-xs">{label}</span>
    </Link>
  );
};

const moreItems = [
    { href: "/agent/deposit", icon: ArrowDownToLine, label: 'Dépôt' },
    { href: "/agent/withdraw", icon: ArrowUpFromLine, label: 'Retrait' },
    { href: "/agent/clients", icon: Users, label: 'Clients' },
    { href: "/agent/commissions", icon: Percent, label: 'Commissions' },
    { href: "/agent/history", icon: History, label: 'Historique' },
    { href: "/agent/reports", icon: BarChart, label: 'Rapports' },
    { href: "/agent/marketing", icon: Megaphone, label: 'Marketing' },
    { href: "/agent/mobile-money-withdrawal", icon: Banknote, label: 'Retrait Mobile' },
    { href: "/agent/profile", icon: User, label: 'Profil' },
];

export function AgentFooter() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();

  const primaryItems = [
    { href: "/agent/dashboard", icon: LayoutDashboard, label: 'Accueil' },
    { href: "/agent/sell", icon: ShoppingCart, label: 'Vente' },
    { href: "/agent/orders", icon: Package, label: 'Commandes' },
    { href: "/agent/boutiques", icon: Store, label: 'Boutiques' },
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t bg-background/95 backdrop-blur-sm">
      <div className="relative">
        <nav className="flex items-center h-16 justify-around">
            {primaryItems.map((item) => (
                <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
            ))}
            {/* Bouton "Plus" ouvre un sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                    <button className={cn(
                        "flex flex-col items-center justify-center w-full h-full text-sm font-medium transition-colors",
                        moreItems.some(i => pathname.startsWith(i.href)) ? "text-primary" : "text-muted-foreground"
                    )}>
                        <MoreHorizontal className="h-6 w-6 mb-1" />
                        <span className="text-xs">Plus</span>
                    </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
                    <SheetHeader className="pb-4">
                        <SheetTitle>Menu Agent</SheetTitle>
                    </SheetHeader>
                    <div className="grid grid-cols-4 gap-4 pb-6">
                        {moreItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSheetOpen(false)}
                                className={cn(
                                    "flex flex-col items-center justify-center p-3 rounded-xl gap-1 transition-colors",
                                    pathname.startsWith(item.href) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                )}
                            >
                                <item.icon className="h-6 w-6" />
                                <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>
        </nav>
      </div>
    </footer>
  );
}
