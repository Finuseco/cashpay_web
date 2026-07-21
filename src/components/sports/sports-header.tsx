
"use client";

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User as UserIcon, Home, Wallet } from "lucide-react";
import type { User } from "@/lib/types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FullscreenToggle } from "../ui/fullscreen-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const SportsLogo = () => (
    <svg viewBox="0 0 250 30" className="h-7 w-auto" aria-label="BestWinMoney.cd">
        <text x="0" y="25" fontFamily="Arial, sans-serif" fontSize="28" fontWeight="bold">
            <tspan fill="#FBBF24">Best</tspan>
            <tspan fill="#FFFFFF" dx="2">Win</tspan>
            <tspan fill="#EF4444" dx="2">Money</tspan>
            <tspan fontSize="12" fill="#A1A1AA" dx="2">.cd</tspan>
        </text>
    </svg>
);


export function SportsHeader({ user, balance }: { user: User | null, balance: string | null }) {
  const { t } = useTranslation();

  return (
    <header className="bg-zinc-800 text-zinc-100 shadow-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-2 md:px-6 relative">
        <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard" aria-label={t('backToCashPay')}>
                    <ArrowLeft />
                </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
                <Link href="/casino" aria-label={t('backToCasinoLobby')}>
                    <Home />
                </Link>
            </Button>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2">
            <SportsLogo />
        </div>
        
        <div className="flex items-center gap-3">
            <FullscreenToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 outline-none">
                    <Avatar className="h-10 w-10 border-2 border-yellow-400">
                        <AvatarImage src={user?.profile_photo || "/avatars/default.png"} alt={user?.full_name || "User"} />
                        <AvatarFallback>
                            <UserIcon />
                        </AvatarFallback>
                    </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-zinc-800 border-zinc-700 text-white" align="end">
                <DropdownMenuLabel>{user?.full_name}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-700"/>
                <DropdownMenuItem className="focus:bg-zinc-700">
                    <Wallet className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                        <span>{t('sportsHeaderBalance')}</span>
                        <span className="font-semibold text-green-500">{balance} CDF</span>
                    </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
