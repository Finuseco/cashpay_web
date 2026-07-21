

'use client';

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { User } from "@/lib/types";

import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    User as UserIcon,
    LogOut,
    Sun,
    Moon,
    ChevronDown,
    LayoutDashboard, 
    Users, 
    ShoppingCart, 
    History, 
    Store,
    Barcode,
    BarChart,
    Code,
    MessageSquare,
    Briefcase,
} from "lucide-react";
import { logout } from "@/lib/actions/auth.actions";

export function AgentMainMenu({ user }: { user: User }) {
  const { open } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const menuItems = [
    { href: "/agent/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { href: "/agent/sell", label: "Vente (POS)", icon: ShoppingCart },
    { href: "/agent/history", label: "Historique", icon: History },
    { href: "/agent/clients", label: "Clients", icon: Users },
  ];
  
  const managementItems = [
    { href: "/agent/boutiques", label: "Gestion Boutiques", icon: Store },
    { href: "/agent/products", label: "Gestion Produits", icon: Store }, // Changed icon to be more generic
    { href: "/agent/barcodes", label: "Imprimer Codes-barres", icon: Barcode },
    { href: "/agent/sellers", label: "Gestion Vendeurs", icon: Users },
    { href: "/agent/reports", label: "Rapports", icon: BarChart },
  ];
  
  const developerItems = [
    { href: "/agent/developer", label: "Développer", icon: Code },
    { href: "/agent/sms-api", label: "APIs", icon: MessageSquare }, // Changed icon as SMS API is not the only one
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <SidebarHeader className="p-0">
        <div className="flex items-start justify-between p-4">
            <Avatar className="h-12 w-12">
                <AvatarImage src={user?.profile_photo || undefined} alt={user?.full_name || ''} />
                <AvatarFallback>{user?.first_name?.[0]}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
            <div>
                <p className="font-semibold text-sidebar-primary">{user?.full_name}</p>
                <p className="text-sm text-sidebar-foreground">{user?.phone}</p>
            </div>
             <Button variant="ghost" size="icon">
                <ChevronDown />
             </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-0">
         <SidebarMenu className="px-2">
            <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
            {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                    <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
             <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Espace Client">
                    <Link href="/dashboard"><Briefcase /><span>Espace Client</span></Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="my-2" />

        <SidebarMenu className="px-2">
            <SidebarGroupLabel>Gestion</SidebarGroupLabel>
            {managementItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                    <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
        
        <SidebarSeparator className="my-2" />

        <SidebarMenu className="px-2">
            <SidebarGroupLabel>Développeur</SidebarGroupLabel>
            {developerItems.map((item) => (
                 <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                        <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2">
         <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Déconnexion</span>
        </Button>
      </SidebarFooter>
    </>
  );
}
