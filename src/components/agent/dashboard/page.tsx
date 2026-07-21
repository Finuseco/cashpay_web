

import { ArrowLeft, Plus, ChevronsRight, DollarSign, Users, TrendingUp, ShoppingCart, PlusCircle, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Tv2, Globe, Percent, Smartphone, Megaphone } from 'lucide-react';
import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import type { Currency } from '@/lib/types';
import { getAgentReportData } from '@/lib/actions/reports.actions';
import { subDays } from 'date-fns';

export async function AgentDashboardPage() {
    
    const user = await getAuthenticatedUser();
    if (!user) {
        return <div>Agent non trouvé.</div>;
    }
    
    const thirtyDaysAgo = subDays(new Date(), 29);
    const today = new Date();

    const [currencies, reportData] = await Promise.all([
        getUserCurrencies(user.id),
        getAgentReportData(user.id, thirtyDaysAgo, today)
    ]);
    
    const idWallet = user?.id_wallet || 'N/A';
    const localCurrency = currencies.find(c => c.code !== 'USD' && c.code !== 'EUR') || { code: 'CDF', symbol: 'FC' };


    const getBalance = (code: string) => {
        const currency = currencies.find(c => c.code === code);
        return currency ? currency.balance : "0.00";
    }

    const balanceCards = [
        { currency: "USD", amount: getBalance("USD"), bgColor: 'bg-[#000E38]' },
        { currency: "EUR", amount: getBalance("EUR"), bgColor: 'bg-blue-600' },
        { currency: localCurrency.code, amount: getBalance(localCurrency.code), bgColor: 'bg-[#FF6600]' },
    ];

    const statCards = [
        { title: "Revenu des Ventes (30j)", value: `$${reportData?.summary.totalRevenue.toFixed(2) || '0.00'}`, icon: <TrendingUp className="h-6 w-6 text-muted-foreground" />, description: "Chiffre d'affaires des produits" },
        { title: "Bénéfice Brut (30j)", value: `$${reportData?.summary.grossProfit.toFixed(2) || '0.00'}`, icon: <DollarSign className="h-6 w-6 text-muted-foreground" />, description: "Marge sur les produits vendus" },
    ];
    
    const actionButtons = [
        { title: "Dépôt Client", href: "/agent/deposit", icon: <ArrowDownToLine className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Retrait Client", href: "/agent/withdraw", icon: <ArrowUpFromLine className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Transfert", href: "/agent/transfer", icon: <ArrowRightLeft className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
        { title: "Clients", href: "/agent/clients", icon: <Users className="h-8 w-8 text-white" />, bgColor: 'bg-gradient-to-br from-[#000E38] to-[#FF6600]' },
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
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {balanceCards.map((card, index) => (
                    <div key={index} className={`flex-shrink-0 w-72 h-32 p-4 rounded-xl text-white shadow-lg flex flex-col justify-between ${card.bgColor}`}>
                        <div className="flex justify-end">
                            <span className="font-bold text-lg">Portefeuille Agent</span>
                        </div>
                        <div>
                           <h2 className="text-3xl font-bold">{card.amount} <span className="text-xl font-medium">{card.currency}</span></h2>
                           <p className="mt-1 text-sm text-white/80">ID: {idWallet}</p>
                        </div>
                    </div>
                ))}
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {statCards.map((card, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            {card.icon}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{card.value}</div>
                            <p className="text-xs text-muted-foreground">{card.description}</p>
                        </CardContent>
                    </Card>
                ))}
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Commissions (30j)</CardTitle>
                        <Percent className="h-6 w-6 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            <div className="text-lg font-bold">{reportData?.summary.totalCommissions.USD.toFixed(2) || '0.00'} USD</div>
                            <div className="text-sm text-muted-foreground">{reportData?.summary.totalCommissions.EUR.toFixed(2) || '0.00'} EUR</div>
                            <div className="text-sm text-muted-foreground">{reportData?.summary.totalCommissions.LOCAL.toFixed(2) || '0.00'} {localCurrency.code}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* List Actions */}
            <div className="space-y-3">
                <button className="w-full flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-[#000E38] to-[#FF6600] text-white font-semibold shadow-md">
                    <span>Gestion des stocks</span>
                    <ChevronsRight className="h-6 w-6" />
                </button>
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
