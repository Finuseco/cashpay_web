

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getOrdersForUser } from '@/lib/actions/shopping.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import type { User, Order, Currency } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Settings, MessageCircle, ChevronRight, Pen, Package, MessageSquareText, Undo2, Heart, Store, History, Ticket, Wallet, Home, User as UserIcon, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

const StatCard = ({ icon: Icon, label, count, onClick }: { icon: React.ElementType, label: string, count?: number, onClick?: () => void }) => (
    <button onClick={onClick} className="relative flex flex-col items-center gap-2 text-center text-xs font-medium text-foreground">
        <Icon className="h-6 w-6 text-muted-foreground" />
        <span className="leading-tight">{label}</span>
        {count != null && count > 0 && <div className="absolute -top-1 -right-2 w-4 h-4 text-white bg-primary rounded-full text-[10px] flex items-center justify-center">{count}</div>}
    </button>
);

const MenuRow = ({ icon: Icon, label, children, href }: { icon: React.ElementType, label: string, children?: React.ReactNode, href: string }) => (
    <Link href={href} className="flex items-center p-4 w-full text-left">
        <Icon className="h-5 w-5 mr-4 text-muted-foreground" />
        <span className="flex-1 font-semibold text-foreground">{label}</span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {children}
            <ChevronRight className="h-4 w-4" />
        </div>
    </Link>
);

function AccountPageLoading() {
    return (
        <div className="pb-24 bg-muted/50 min-h-screen">
            <div className="h-32 bg-gradient-to-b from-primary/80 to-primary/60 p-4 relative" />
            <div className="px-4 -mt-14">
                <Card className="p-4 shadow-md">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                    </div>
                </Card>
            </div>
             <div className="px-4 mt-4">
                <Card className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <Skeleton className="h-6 w-24" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[...Array(4)].map((i, idx) => <div key={idx} className="flex flex-col items-center gap-2"><Skeleton className="h-12 w-12" /><Skeleton className="h-4 w-16" /></div>)}
                    </div>
                </Card>
            </div>
             <div className="px-4 mt-4 space-y-3">
                <Card><div className="h-14"><Skeleton className="h-full w-full"/></div></Card>
                <Card><div className="h-14"><Skeleton className="h-full w-full"/></div></Card>
            </div>
        </div>
    )
}


export default function AccountPage() {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            if (!fetchedUser) {
                router.replace('/login');
                return;
            }
            setUser(fetchedUser);
            const [fetchedOrders, fetchedCurrencies] = await Promise.all([
                getOrdersForUser(fetchedUser.id),
                getUserCurrencies(fetchedUser.id)
            ]);
            setOrders(fetchedOrders);
            setCurrencies(fetchedCurrencies);
            setIsLoading(false);
        };
        fetchData();
    }, [router]);
    
    if (isLoading || !user) {
        return <AccountPageLoading />;
    }

    const usdBalance = currencies.find(c => c.code === 'USD')?.balance || '0.00';
    const pendingPaymentCount = orders.filter(o => o.status === 'pending').length;
    const toShipCount = orders.filter(o => o.status === 'paid').length;
    const shippedCount = orders.filter(o => o.status === 'shipped').length;
    const toReviewCount = orders.filter(o => o.status === 'delivered').length;

    return (
        <div className="pb-24 bg-muted/50 min-h-screen">
            <div className="h-32 bg-gradient-to-b from-primary/80 to-primary/60 p-4 relative text-primary-foreground">
                <div className="absolute top-4 right-4 flex gap-2">
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => router.push('/settings')}><Settings /></Button>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => router.push('/feedback')}><MessageCircle /></Button>
                </div>
            </div>

            <div className="px-4 -mt-14">
                <Card className="p-4 shadow-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 border-2 border-white">
                                <AvatarImage src={user.profile_photo || undefined} />
                                <AvatarFallback>{user.first_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-lg text-foreground">{user.full_name}</p>
                                <div className="inline-flex items-center rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 mt-1">VIP 0</div>
                            </div>
                        </div>
                        <Button asChild variant="ghost" size="icon"><Link href="/profile"><Pen className="h-4 w-4 text-muted-foreground" /></Link></Button>
                    </div>
                </Card>
            </div>

            <div className="px-4 mt-4">
                <Card className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-foreground">{t('myOrdersTitle')}</h2>
                        <Link href="/shopping/orders" className="text-xs text-muted-foreground font-semibold">{t('myOrdersViewAll')} <ChevronRight className="inline h-3 w-3"/></Link>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <StatCard icon={Wallet} label={t('myOrdersPendingPayment')} count={pendingPaymentCount} onClick={() => router.push('/shopping/orders?status=pending')}/>
                        <StatCard icon={Package} label={t('myOrdersToShip')} count={toShipCount} onClick={() => router.push('/shopping/orders?status=paid')}/>
                        <StatCard icon={Truck} label={t('myOrdersShipped')} count={shippedCount} onClick={() => router.push('/shopping/orders?status=shipped')}/>
                        <StatCard icon={MessageSquareText} label={t('myOrdersToReview')} count={toReviewCount} onClick={() => router.push('/shopping/orders?status=delivered')}/>
                    </div>
                </Card>
            </div>

            <div className="px-4 mt-4 space-y-3">
                <Card className="divide-y">
                     <MenuRow href="/shopping/wishlist" icon={Heart} label={t('myAccountWishlist')}>
                         <div className="flex -space-x-2 mr-2">
                            <Image src="https://placehold.co/40x40.png" width={28} height={28} className="rounded-md border-2 bg-white border-white" alt="wishlist item 1" data-ai-hint="fashion dress"/>
                         </div>
                    </MenuRow>
                     <MenuRow href="/shopping/followed-stores" icon={Store} label={t('myAccountFollowedStores')} />
                    <MenuRow href="/shopping/history" icon={History} label={t('myAccountRecentlyViewed')} />
                    <MenuRow href="/shopping/vouchers" icon={Ticket} label={t('myAccountVouchers')} />
                </Card>

                <Card className="divide-y">
                    <MenuRow href="/dashboard" icon={Wallet} label={t('myAccountWallet')}>
                        <span className="font-semibold text-foreground">${usdBalance}</span>
                    </MenuRow>
                    <MenuRow href="/shopping/address" icon={Home} label={t('myAccountAddressManagement')}/>
                </Card>

                 <Card className="divide-y">
                    <MenuRow href="/feedback" icon={MessageCircle} label={t('myAccountServiceCenter')} />
                    <MenuRow href="/referral" icon={UserIcon} label={t('myAccountInviteFriend')} />
                </Card>
            </div>
        </div>
    );
}
