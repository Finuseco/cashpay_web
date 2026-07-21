
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Home, CreditCard, User, History, Plus, Send, QrCode, ScanLine, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useFooterStore } from "@/hooks/use-footer-store";
import { AnimatePresence, motion } from "framer-motion";

const NavItem = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  
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

const ActionShortcut = ({ href, icon: Icon, label }: { href: string, icon: React.ElementType, label: string }) => (
    <Link href={href} className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50 text-center">
        <Icon className="h-8 w-8 text-primary" />
        <span className="text-sm font-semibold">{label}</span>
    </Link>
)


export function DashboardFooter() {
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { isVisible } = useFooterStore();


  useEffect(() => {
    setIsClient(true);
  }, []);

  const footerNavItems = [
    { href: "/dashboard", icon: Home, labelKey: 'footerHome', label: 'Home' },
    { href: "/transactions", icon: History, labelKey: 'footerHistory', label: 'History' },
    { href: "/cards", icon: CreditCard, labelKey: 'footerCards', label: 'Cards' },
    { href: "/profile", icon: User, labelKey: 'footerProfile', label: 'Profile' },
  ];
  
  const getLabel = (item: { labelKey: string, label: string }) => {
    return isClient ? t(item.labelKey, item.label) : item.label;
  }

  const leftItems = footerNavItems.slice(0, 2);
  const rightItems = footerNavItems.slice(2, 4);
  
  if (!isClient) {
      return (
          <footer className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
              <div className="h-16 bg-card border-t"></div>
          </footer>
      );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.footer
          initial={{ y: "100%" }}
          animate={{ y: "0%" }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card border-t"
        >
          <div className="relative">
            <nav className="flex items-center h-16">
                <div className="flex w-2/5 justify-around">
                    {leftItems.map((item) => (
                        <NavItem key={item.href} href={item.href} icon={item.icon} label={getLabel(item)} />
                    ))}
                </div>

                <div className="w-1/5 flex justify-center">
                     <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                             <Button 
                                aria-label="New Action"
                                className="relative flex items-center justify-center h-16 w-16 bg-primary text-primary-foreground rounded-full shadow-lg transform -translate-y-1/2 border-4 border-background"
                             >
                                <Plus className="h-8 w-8" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-2xl">
                            <SheetHeader className="mb-6">
                                <SheetTitle className="text-center">{t('dashboardQuickActions')}</SheetTitle>
                            </SheetHeader>
                             <div className="grid grid-cols-2 gap-4">
                                <ActionShortcut href="/send" icon={Send} label={t('actionGridSend')} />
                                <ActionShortcut href="/receive" icon={QrCode} label={t('actionGridReceive')} />
                                <ActionShortcut href="/pay" icon={ScanLine} label={t('actionGridPay')} />
                                <ActionShortcut href="/deposit" icon={Wallet} label={t('actionGridDeposit')} />
                             </div>
                        </SheetContent>
                    </Sheet>
                </div>

                <div className="flex w-2/5 justify-around">
                    {rightItems.map((item) => (
                        <NavItem key={item.href} href={item.href} icon={item.icon} label={getLabel(item)} />
                    ))}
                </div>
            </nav>
          </div>
        </motion.footer>
      )}
    </AnimatePresence>
  );
}
