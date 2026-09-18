
'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Bell, LogOut, Settings, User as UserIcon, Briefcase, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { User, Currency, Notification, Card } from "@/lib/types";
import { CurrencyCard } from "./currency-card";
import { BitcoinBalanceCard } from "./bitcoin-balance-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/actions/auth.actions';
import { LanguageSwitcher } from '../ui/language-switcher';
import { getNotifications, markAllNotificationsAsRead } from "@/lib/actions/notification.actions";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ScrollArea } from "../ui/scroll-area";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useFooterStore } from "@/hooks/use-footer-store";
import { getCryptoBalances, getUserCryptoAddresses, activateBitcoinAccount } from "@/lib/actions/crypto.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DepositFlow } from "@/components/crypto/deposit-flow";
import { WithdrawalFlow } from "@/components/crypto/withdrawal-flow";
import { ConversionFlow } from "@/components/crypto/conversion-flow";

function NotificationItem({ notification }: { notification: Notification }) {
    return (
        <Link href={notification.link || '#'} className="block w-full">
            <div className="flex items-start gap-3 py-2 px-3 hover:bg-muted/50 rounded-md">
                {!notification.read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />}
                <div className={cn(!notification.read ? "pl-0" : "pl-4")}>
                    <p className="font-semibold text-sm">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">{notification.description}</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">{formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true, locale: fr })}</p>
                </div>
            </div>
        </Link>
    )
}


export function DashboardHeader({ user, currencies, cards, children, pageTitle }: { user: User | null; currencies?: Currency[], cards?: Card[], children?: React.ReactNode, pageTitle?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [renderedPageTitle, setRenderedPageTitle] = useState(pageTitle);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cryptoBalances, setCryptoBalances] = useState<any[]>([]);
  const [bitcoinAction, setBitcoinAction] = useState<"receive" | "send" | "buy" | "sell" | null>(null);
  const [isBitcoinActivated, setIsBitcoinActivated] = useState(false);
  const { isVisible: isFooterVisible, toggleVisibility: toggleFooterVisibility } = useFooterStore();

  useEffect(() => {
    let cancelled = false;

    const loadCryptoBalances = async () => {
      if (!user?.id) return;

      try {
        const balances = await getCryptoBalances(user.id);
        const addresses = await getUserCryptoAddresses(user.id);

        if (!cancelled) {
          setIsBitcoinActivated(Boolean(addresses.BTC));
          setCryptoBalances(balances);
        }
      } catch (error) {
        console.error("[DashboardHeader] Failed to load crypto balances:", error);
      }
    };

    loadCryptoBalances();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    setIsClient(true);
    setRenderedPageTitle(pageTitle);
    if (user) {
        getNotifications(user.id, 20).then(data => {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read).length);
        });
    }
  }, [user, pageTitle]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const isAgent = user?.role === 'Agent' || user?.role === 'Admin';
  // Updated to include SubSuperAgent
  const isSuperAgent = user?.role === 'SuperAgent' || user?.role === 'SubSuperAgent' || user?.role === 'Admin';
  
  const hasBalanceCards = currencies && currencies.length > 0;
  
  const handleOpenNotifications = async () => {
    if (unreadCount > 0 && user) {
        await markAllNotificationsAsRead(user.id);
        setUnreadCount(0);
        setNotifications(notifications.map(n => ({...n, read: true})));
    }
  }

  return (
    <header className="relative bg-gradient-to-br from-[#000E38] to-[#FF6600] text-primary-foreground pb-4 shadow-lg rounded-b-[2rem]">
      <div className="container mx-auto pt-4 px-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm font-medium">
              <Avatar className="h-10 w-10 border-2 border-white/50">
                <AvatarImage src={user?.profile_photo || undefined} alt={user?.full_name || "User"} />
                <AvatarFallback>{user?.first_name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-xs opacity-80">{isClient ? t('pinLockWelcomeBack', { name: '' }).replace(', ','') : "Welcome back"}</span>
                <span className="font-bold -mt-1">{user?.first_name || 'User'}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
                <LanguageSwitcher />
                <DropdownMenu onOpenChange={(open) => { if(open) handleOpenNotifications()}}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative h-10 w-10 text-white hover:bg-white/20 rounded-full">
                            <Bell className="h-6 w-6" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                         <DropdownMenuLabel className="flex justify-between items-center">
                            <span>Notifications</span>
                            <Link href="/notifications" className="text-xs font-normal text-primary hover:underline">Voir tout</Link>
                         </DropdownMenuLabel>
                         <DropdownMenuSeparator/>
                         <ScrollArea className="h-[400px]">
                            {notifications.length > 0 ? (
                                notifications.map((n, i) => (
                                    <DropdownMenuItem key={i} className="p-0">
                                        <NotificationItem notification={n} />
                                    </DropdownMenuItem>
                                ))
                            ) : (
                                <div className="text-center text-sm text-muted-foreground p-8">{t('noNotifications')}</div>
                            )}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>

                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/20 rounded-full">
                      <Settings className="h-6 w-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Mon Compte</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/profile')}>
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Paramètres</span>
                    </DropdownMenuItem>
                     <DropdownMenuItem onClick={toggleFooterVisibility} className="md:hidden">
                        {isFooterVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                        <span>{isFooterVisible ? 'Masquer la barre de navigation' : 'Afficher la barre de navigation'}</span>
                    </DropdownMenuItem>
                    
                    {isSuperAgent && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/super-agent/dashboard')}>
                          <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
                          <span className="font-bold">Espace Super Agent</span>
                        </DropdownMenuItem>
                      </>
                    )}

                    {isAgent && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/agent/dashboard')}>
                          <Briefcase className="mr-2 h-4 w-4" />
                          <span>Espace Agent</span>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:text-red-500 focus:bg-red-50">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Se déconnecter</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        {hasBalanceCards && cards ? (
             <div className="mt-6">
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                    {currencies.map((currency) => {
                        const associatedCard = cards.find(card => card.currency === currency.code && card.card_type === 'virtuelle' && card.status === 'active');
                        return (
                            <CurrencyCard 
                                key={currency.code} 
                                {...currency}
                                idWallet={user?.id_wallet || null}
                                holderName={user?.full_name || null}
                                cardBrand={associatedCard?.brand}
                                cardLast4={associatedCard?.last4}
                            />
                        )
                    })}

                    <BitcoinBalanceCard
                        btcBalance={
                            Number(
                                cryptoBalances.find(
                                    (item) => item.currency_code === "BTC"
                                )?.balance ?? 0
                            )
                        }
                        onReceive={() => setBitcoinAction("receive")}
                        onSend={() => setBitcoinAction("send")}
                        onBuy={() => setBitcoinAction("buy")}
                        onSell={() => setBitcoinAction("sell")}
                        onActivate={async () => {
                          if (!user?.id) return;
                          const result = await activateBitcoinAccount(user.id);
                          if (result.success) {
                            setIsBitcoinActivated(true);
                            const balances = await getCryptoBalances(user.id);
                            setCryptoBalances(balances);
                          } else {
                            console.error("[DashboardHeader] Bitcoin activation failed:", result.error);
                          }
                        }}
                        isActivated={isBitcoinActivated}
                    />
                </div>
            </div>
         ) : renderedPageTitle ? (
                 <h1 className="text-2xl font-bold text-center py-10">{renderedPageTitle}</h1>
             ) : null}
     
           </div>

           {bitcoinAction && user && (
             <Dialog open={!!bitcoinAction} onOpenChange={(open) => !open && setBitcoinAction(null)}>
               <DialogContent className="w-[calc(100%-24px)] max-w-lg max-h-[85vh] overflow-y-auto bg-zinc-900 border-zinc-700 p-0">
                 <DialogHeader className="px-5 pt-5">
                   <DialogTitle className="text-white">
                     {bitcoinAction === "receive" && "Recevoir du Bitcoin"}
                     {bitcoinAction === "send" && "Envoyer du Bitcoin"}
                     {bitcoinAction === "buy" && "Acheter du Bitcoin"}
                     {bitcoinAction === "sell" && "Vendre du Bitcoin"}
                   </DialogTitle>
                 </DialogHeader>

                 <div className="px-4 pb-5">
                   {bitcoinAction === "receive" && (
                     <DepositFlow user={user} />
                   )}

                   {bitcoinAction === "send" && (
                     <WithdrawalFlow
                       user={user}
                       balances={cryptoBalances}
                     />
                   )}

                   {bitcoinAction === "buy" && (
                     <ConversionFlow
                       user={user}
                       balances={cryptoBalances}
                       fiatCurrencies={currencies || []}
                     />
                   )}

                   {bitcoinAction === "sell" && (
                     <ConversionFlow
                       user={user}
                       balances={cryptoBalances}
                       fiatCurrencies={currencies || []}
                     />
                   )}
                 </div>
               </DialogContent>
             </Dialog>
           )}

           {children && 
             <div className="container mx-auto">
                 {children}
             </div>
           }
         </header>
       );
     }
