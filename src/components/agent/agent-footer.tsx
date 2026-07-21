
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ShoppingCart, History, User, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

const NavItem = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) => {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);
  
  return (
     <Link
      href={href}
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

export function AgentFooter() {
  const footerNavItems = [
    { href: "/agent/dashboard", icon: LayoutDashboard, label: 'Accueil' },
    { href: "/agent/sell", icon: ShoppingCart, label: 'Vente (POS)' },
    { href: "/agent/orders", icon: Package, label: 'Commandes' },
    { href: "/agent/history", icon: History, label: 'Historique' },
    { href: "/agent/profile", icon: User, label: 'Profil' },
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t bg-background/95 backdrop-blur-sm">
      <div className="relative">
        <nav className="flex items-center h-16 justify-around">
            {footerNavItems.map((item) => (
                <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
            ))}
        </nav>
      </div>
    </footer>
  );
}
