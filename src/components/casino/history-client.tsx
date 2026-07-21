
'use client';

import type { CasinoTransaction } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowDownLeft, ArrowUpRight, DollarSign, History } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';


const TransactionIcon = ({ type }: { type: CasinoTransaction['tx_type'] }) => {
    switch (type) {
        case 'win':
        case 'deposit':
            return <ArrowDownLeft className="h-5 w-5 text-green-500" />;
        case 'bet':
        case 'loss':
            return <ArrowUpRight className="h-5 w-5 text-red-500" />;
        default:
            return <DollarSign className="h-5 w-5 text-zinc-400" />;
    }
}

export function HistoryClient({ transactions }: { transactions: CasinoTransaction[] }) {
    const { t } = useTranslation();
    return (
        <div className="p-4">
            <Card className="bg-zinc-800/50 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History/> {t('casinoHistoryTitle')}</CardTitle>
                    <CardDescription>{t('casinoHistoryDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[calc(100vh-250px)]">
                        <div className="space-y-3 pr-4">
                            {transactions.length > 0 ? transactions.map(tx => (
                                <div key={tx.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700">
                                            <TransactionIcon type={tx.tx_type} />
                                        </div>
                                        <div>
                                            <p className="font-semibold capitalize">{tx.description}</p>
                                            <p className="text-xs text-zinc-400">
                                                {format(new Date(tx.timestamp), 'dd MMMM yyyy, HH:mm', { locale: fr })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn(
                                            "font-bold text-lg",
                                            (tx.tx_type === 'win' || tx.tx_type === 'deposit') ? 'text-green-500' : 'text-red-500'
                                        )}>
                                             {(tx.tx_type === 'win' || tx.tx_type === 'deposit') ? '+' : '-'} {tx.amount.toLocaleString()} {tx.currency}
                                        </p>
                                        <p className="text-xs font-mono text-zinc-500">{tx.reference_code}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-16 text-zinc-500">{t('casinoHistoryNoActivity')}</div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
