
import { ArrowLeft, Plus, ChevronsRight, DollarSign, Users, TrendingUp, ShoppingCart, PlusCircle, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Tv2, Globe, Percent, Smartphone, Megaphone, Banknote, Wallet } from 'lucide-react';
import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import type { Currency } from '@/lib/types';
import { getAgentReportData } from '@/lib/actions/reports.actions';
import { subDays } from 'date-fns';

export default async function AgentDashboardPage() {
    
    const user = await getAuthenticatedUser();
    if (!user) {
        return <div>Agent non trouvé.</div>;
    }
    
    const currencies = await getUserCurrencies(user.id);
    const localCurrency = currencies.find(c => c.code !== 'USD' && c.code !== 'EUR');

    const getBalance = (code: string) => {
        const currency = currencies.find(c => c.code === code);
        return {
            amount: currency ? currency.balance : "0.00",
            symbol: currency ? currency.symbol : '$'
        }
    }

    const actionButtons = [
        { title: "Dépôt Client", href: "/agent/deposit", icon: <ArrowDownToLine className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Retrait Client", href: "/agent/withdraw", icon: <ArrowUpFromLine className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Transfert", href: "/agent/transfer", icon: <ArrowRightLeft className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Retrait Mobile Money", href: "/agent/mobile-money-withdrawal", icon: <Banknote className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Vendre Produit", href: "/agent/sell", icon: <ShoppingCart className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Gestion Produits", href: "/agent/products", icon: <PlusCircle className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Acheter Crédit", href: "/agent/airtime", icon: <Smartphone className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Réabonnement TV", href: "/agent/tv-subscription", icon: <Tv2 className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Transfert Inter.", href: "/agent/international-transfer", icon: <Globe className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Marketing", href: "/agent/marketing", icon: <Megaphone className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
    ];

    return (
        <div className="space-y-6">
            {/* Balance Cards */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="relative overflow-hidden bg-[#000E38] text-white border-none shadow-lg">
                    <Wallet className="absolute -right-8 -bottom-8 h-32 w-32 text-white/10 -rotate-12" />
                    <CardHeader className="relative z-10">
                        <CardTitle className="text-white/90 text-sm font-medium">Solde USD</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold">{getBalance("USD").symbol}{getBalance("USD").amount}</div>
                        <p className="text-xs text-white/70">Portefeuille principal</p>
                    </CardContent>
                </Card>
                 <Card className="relative overflow-hidden bg-blue-600 text-white border-none shadow-lg">
                    <Wallet className="absolute -right-8 -bottom-8 h-32 w-32 text-white/10 -rotate-12" />
                    <CardHeader className="relative z-10">
                        <CardTitle className="text-white/90 text-sm font-medium">Solde EUR</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold">{getBalance("EUR").symbol}{getBalance("EUR").amount}</div>
                        <p className="text-xs text-white/70">Portefeuille secondaire</p>
                    </CardContent>
                </Card>
                {localCurrency && (
                    <Card className="relative overflow-hidden bg-[#FF6600] text-white border-none shadow-lg">
                        <Wallet className="absolute -right-8 -bottom-8 h-32 w-32 text-white/10 -rotate-12" />
                        <CardHeader className="relative z-10">
                            <CardTitle className="text-white/90 text-sm font-medium">Solde {localCurrency.code}</CardTitle>
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="text-3xl font-bold">{getBalance(localCurrency.code).symbol}{getBalance(localCurrency.code).amount}</div>
                            <p className="text-xs text-white/70">Portefeuille local</p>
                        </CardContent>
                    </Card>
                )}
            </div>
            
            {/* Action Grid */}
             <div>
                <h3 className="text-lg font-bold text-foreground mb-3">Actions Rapides</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                    {actionButtons.map((action, index) => (
                        <Link href={action.href} key={index} className={`flex flex-col items-center justify-center p-4 rounded-xl shadow-md h-28 ${action.bgColor} hover:opacity-90 transition-opacity`}>
                            {action.icon}
                            <p className="mt-2 font-semibold text-white text-center text-sm">{action.title}</p>
                        </Link>
                    ))}
                </div>
            </div>

            {/* List Actions */}
            <div className="space-y-3">
                <Link href="/agent/products" className="w-full flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-[#000E38] to-[#FF6600] text-white font-semibold shadow-md">
                    <span>Gestion des stocks</span>
                    <ChevronsRight className="h-6 w-6" />
                </Link>
                <Link href="/agent/history" className="w-full flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-[#000E38] to-[#FF6600] text-white font-semibold shadow-md">
                    <span>Historiques des transactions</span>
                    <ChevronsRight className="h-6 w-6" />
                </Link>
                 <Link href="/agent/reports" className="w-full flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-[#000E38] to-[#FF6600] text-white font-semibold shadow-md">
                    <span>Rapports de commissions</span>
                    <ChevronsRight className="h-6 w-6" />
                </Link>
            </div>
        </div>
    );
}
