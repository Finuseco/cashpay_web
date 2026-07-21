
'use client';

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Wallet, CreditCard, QrCode, Smartphone, Tv, Globe, Repeat, Handshake, ScanLine, Send, Percent, PiggyBank, Gift, Clapperboard, Map, ShoppingCart, Plane, Server, NotebookPen, BrainCircuit, Landmark, Satellite, Receipt, MoreHorizontal, MessageCircle, FileText, Briefcase, Ticket, Radio, Newspaper, Megaphone, Users, Fuel, Link2Icon, UsbIcon } from "lucide-react";
import type { LucideProps } from "lucide-react";
import React from 'react';
import { cn } from "@/lib/utils";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";


type ActionItem = {
    href?: string;
    labelKey: string;
    icon: React.FC<LucideProps> | string; // Allow string for image URLs
    onClick?: (e: React.MouseEvent) => void;
};

const ActionIcon = ({ icon: Icon, label, href, onClick }: { icon: React.FC<LucideProps> | string, label: string, href?: string, onClick?: (e: React.MouseEvent) => void }) => (
    <Link href={href || '#'} onClick={onClick} className="flex flex-col items-center justify-center gap-2 p-2 rounded-xl text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-card shadow-sm">
            {typeof Icon === 'string' ? (
                <Image src={Icon} alt={label} width={32} height={32} />
            ) : (
                <Icon className="h-7 w-7 text-primary" />
            )}
        </div>
        <p className="text-xs font-medium text-foreground">{label}</p>
    </Link>
);

export function ActionGrid() {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);
    
    const handleComingSoon = (featureName: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        openAlert({
            title: t('featureComingSoonTitle'),
            description: t('featureComingSoonDescription', { feature: featureName }),
            variant: "info",
        });
    };

    const mainActions: ActionItem[] = [
        { href: "/deposit", labelKey: "actionGridDeposit", icon: Wallet },
        { href: "/send", labelKey: "actionGridSend", icon: Send },
        { href: "/pay", labelKey: "actionGridPay", icon: ScanLine },        
        { href: "/cpk", labelKey: "CPK", icon: UsbIcon },
        { href: "/feedback", labelKey: "actionGridOnchat", icon: MessageCircle },
    ];
    
     const allActions: ActionItem[] = [
        ...mainActions,
        { href: "/receive", labelKey: "actionGridReceive", icon: QrCode },
        { href: "/fuel", labelKey: "actionGridFuel", icon: Fuel },
        { href: "/mlm", labelKey: "actionGridMlm", icon: Users },
        { href: "/payment-links", labelKey: "actionGridPaymentLink", icon: Link2Icon },
        { href: "/marketing/ads", labelKey: "actionGridAds", icon: Megaphone },
        { href: "/africoin", labelKey: "actionGridAfriCoin", icon: '/logos/crypto/afc.png' },
        { href: "/bank-transfer", labelKey: "actionGridBankTransfer", icon: Landmark },
        { href: "/bills", labelKey: "actionGridBills", icon: Receipt },
        { href: "/shopping", labelKey: "actionGridShopping", icon: ShoppingCart },
        { href: "/cards", labelKey: "actionGridGetCard", icon: CreditCard, },
        { href: "/checks", labelKey: "actionGridChecks", icon: NotebookPen },
        { href: "/tv-subscription", labelKey: "actionGridTV", icon: Tv },
        { href: "/events", labelKey: "actionGridEvents", icon: Ticket },
        { href: "/starlink/dashboard", labelKey: "actionGridStarlink", icon: Satellite },
        { href: "/flights", labelKey: "actionGridFlights", icon: Plane },
        { href: "/casino/chess", labelKey: "actionGridChess", icon: BrainCircuit },
        { href: "/bank-statement", labelKey: "sidebarBankStatement", icon: FileText },
        { href: "/cloudmax", labelKey: "actionGridCloudMax", icon: Server, },
        { href: "/b2b", labelKey: "actionGridB2B", icon: Briefcase },
        { href: "/exchange", labelKey: "actionGridExchange", icon: Repeat },
        { href: "/investment", labelKey: "actionGridDat", icon: PiggyBank },
        { href: "/referral", labelKey: "actionGridReferral", icon: Gift },
        { href: "/fees", labelKey: "actionGridFees", icon: Percent },
        { href: "/loan", labelKey: "actionGridLoan", icon: Handshake },    
        { href: "/cinema", labelKey: "actionGridCinema", icon: Clapperboard, onClick: handleComingSoon("NetOn Cinéma") },
        { href: "/monpays", labelKey: "actionGridMonPays", icon: Map, onClick: handleComingSoon("MonPays") },
        { href: "/podcast", labelKey: "pageTitlePodcast", icon: Radio },
        { href: "/news", labelKey: "pageTitleNews", icon: Newspaper },

    ];
    
    const uniqueAllActions = allActions.reduce((acc, current) => {
        if (!acc.find(item => item.labelKey === current.labelKey)) {
            acc.push(current);
        }
        return acc;
    }, [] as ActionItem[]);


    if (!isClient) {
        return (
            <section>
                <div className="grid grid-cols-5 gap-4 px-4 py-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <Skeleton className="h-14 w-14 rounded-full" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section>
            <div className="grid grid-cols-5 gap-2 sm:gap-4 px-2 py-2">
                {mainActions.map((action, index) => (
                    <ActionIcon 
                        key={action.labelKey + index}
                        href={action.href}
                        icon={action.icon}
                        label={t(action.labelKey, {defaultValue: action.labelKey})}
                        onClick={action.onClick ? action.onClick : undefined}
                    />
                ))}
                 <Sheet>
                    <SheetTrigger asChild>
                         <div className="flex flex-col items-center justify-center gap-2 p-2 rounded-xl text-center cursor-pointer">
                            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-card shadow-sm">
                                <MoreHorizontal className="h-7 w-7 text-primary" />
                            </div>
                            <p className="text-xs font-medium text-foreground">{t('actionGridSeeAll')}</p>
                        </div>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl flex flex-col">
                        <SheetHeader>
                            <SheetTitle className="text-center">{t('actionGridAllActions')}</SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="flex-grow">
                            <div className="grid grid-cols-4 gap-4 p-4 mt-4">
                                {uniqueAllActions.map((action, index) => (
                                    <ActionIcon 
                                        key={action.labelKey + index}
                                        href={action.href}
                                        icon={action.icon}
                                        label={t(action.labelKey, {defaultValue: action.labelKey})}
                                        onClick={action.onClick ? action.onClick : undefined}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </SheetContent>
                </Sheet>
            </div>
        </section>
    );
}
