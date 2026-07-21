
'use client';

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
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
  Users,
  Contact,
  Phone,
  Bookmark,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  Wallet,
  Send,
  ScanLine,
  QrCode,
  ShoppingCart,
  CreditCard,
  Smartphone,
  Tv,
  Globe,
  Repeat,
  Handshake,
  PiggyBank,
  Gift,
  Clapperboard,
  Map,
  Plane,
  FileText,
  Bell,
  Satellite,
  Briefcase,
  Ticket,
  Radio,
  Newspaper,
  Megaphone,
} from "lucide-react";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { logout } from "@/lib/actions/auth.actions";

export function MainMenu({ user }: { user: User | null }) {
  const { open } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const menuItems = [
    { href: "/profile", labelKey: "sidebarMyProfile", icon: UserIcon },
    { href: "/dashboard", labelKey: "sidebarWallet", icon: Wallet },
    { href: "/notifications", labelKey: "headerNotifications", icon: Bell },
    { href: "/bank-statement", labelKey: "sidebarBankStatement", icon: FileText },
  ];

  const quickActions = [
      { href: "/deposit", labelKey: "actionGridDeposit", icon: Wallet },
      { href: "/send", labelKey: "actionGridSend", icon: Send },
      { href: "/pay", labelKey: "actionGridPay", icon: ScanLine },
      { href: "/receive", labelKey: "actionGridReceive", icon: QrCode },
      { href: "/shopping", labelKey: "actionGridShopping", icon: ShoppingCart },
      { href: "/cards", labelKey: "actionGridGetCard", icon: CreditCard },
      { href: "/airtime", labelKey: "actionGridAirtime", icon: Smartphone },
      { href: "/tv-subscription", labelKey: "actionGridTV", icon: Tv },
      { href: "/starlink/dashboard", labelKey: "actionGridStarlink", icon: Satellite },
      { href: "/flights", labelKey: "actionGridFlights", icon: Plane },
      { href: "/exchange", labelKey: "actionGridExchange", icon: Repeat },
      { href: "/loan", labelKey: "actionGridLoan", icon: Handshake },
      { href: "/investment", labelKey: "actionGridDat", icon: PiggyBank },
      { href: "/referral", labelKey: "actionGridReferral", icon: Gift },
      { href: "/mlm", labelKey: "actionGridMlm", icon: Users },
      { href: "/fees", labelKey: "actionGridFees", icon: Percent },
      { href: "/cinema", labelKey: "actionGridCinema", icon: Clapperboard },
      { href: "/monpays", labelKey: "actionGridMonPays", icon: Map },
  ];

  const enterpriseActions = [
    { href: "/b2b", labelKey: "actionGridB2B", icon: Briefcase },
  ];

  const secondaryMenuItems = [
      { href: "#", labelKey: "sidebarNewGroup", icon: Users },
      { href: "/feedback", labelKey: "sidebarContacts", icon: Contact },
      { href: "#", labelKey: "sidebarCalls", icon: Phone },
      { href: "#", labelKey: "sidebarSavedMessages", icon: Bookmark },
      { href: "/settings", labelKey: "sidebarSettings", icon: Settings },
      { href: "/faq", labelKey: "sidebarFaq", icon: HelpCircle },
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
            {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={t(item.labelKey)}
                >
                    <Link href={item.href}>
                    <item.icon />
                    <span>{t(item.labelKey)}</span>
                    </Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>

        <SidebarSeparator className="my-2" />

        <SidebarMenu className="px-2">
            <SidebarGroupLabel>{t('dashboardQuickActions')}</SidebarGroupLabel>
            {quickActions.map((item) => (
                <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={t(item.labelKey)}
                >
                    <Link href={item.href}>
                    <item.icon />
                    <span>{t(item.labelKey)}</span>
                    </Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>

        <SidebarSeparator className="my-2" />

         <SidebarMenu className="px-2">
            <SidebarGroupLabel>Entreprise</SidebarGroupLabel>
            {enterpriseActions.map((item) => (
                <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={t(item.labelKey)}
                >
                    <Link href={item.href}>
                    <item.icon />
                    <span>{t(item.labelKey)}</span>
                    </Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>


        <SidebarSeparator className="my-2" />

        <SidebarMenu className="px-2">
            {secondaryMenuItems.map((item) => (
                 <SidebarMenuItem key={item.labelKey}>
                    <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.href) && item.href !== "#"}
                        tooltip={t(item.labelKey)}
                        disabled={item.href === "#"}
                    >
                        <Link href={item.href}>
                            <item.icon />
                            <span>{t(item.labelKey)}</span>
                        </Link>
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
              <span className="group-data-[collapsible=icon]:hidden">{t('headerLogout')}</span>
        </Button>
      </SidebarFooter>
    </>
  );
}
    