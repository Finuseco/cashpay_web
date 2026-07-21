'use client';

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import type { User } from "@/lib/types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FullscreenToggle } from "@/components/ui/fullscreen-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image";

export function AfriCoinHeader({ selectedCurrency = 'AfriCoin' }: { selectedCurrency?: string }) {
  const { t } = useTranslation();

  return (
    <header className="bg-zinc-900 text-zinc-100">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 relative">
        <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard" aria-label={t('backToCashPay')}>
                    <ArrowLeft />
                </Link>
            </Button>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2">
            <h2 className="text-lg font-bold">{selectedCurrency.replace('_ERC20', '').replace('_TRC20', '')}</h2>
        </div>
        
        <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
                <MoreHorizontal />
            </Button>
        </div>
      </div>
    </header>
  );
}
