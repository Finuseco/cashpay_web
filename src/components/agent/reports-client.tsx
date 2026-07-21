

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { Calendar as CalendarIcon, DollarSign, TrendingUp, Package, Coins, BarChart3 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import Image from 'next/image';
import { getAgentReportData, type AgentReportData } from '@/lib/actions/reports.actions';
import { Skeleton } from '../ui/skeleton';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { User } from '@/lib/types';


function ReportsLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-9 w-48 mb-2" />
                <Skeleton className="h-5 w-72" />
            </div>
            
            <div className="flex justify-end">
                <Skeleton className="h-10 w-64" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle><Skeleton className="h-6 w-1/2" /></CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <Skeleton className="h-[350px] w-full" />
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle><Skeleton className="h-6 w-1/2" /></CardTitle>
                        <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                        <div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                        <div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                        <div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export function ReportsClient() {
    const { t } = useTranslation();
    const [reportData, setReportData] = useState<AgentReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateRange | undefined>({
        from: subDays(new Date(), 29),
        to: new Date(),
    });

    const fetchReports = useCallback(async () => {
        const user = await getAuthenticatedUser();
        if (!user) return;
        setIsLoading(true);
        const data = await getAgentReportData(user.id, date?.from, date?.to);
        setReportData(data);
        setIsLoading(false);
    }, [date]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    if (isLoading) {
        return <ReportsLoading />;
    }
    
    if (!reportData) {
        return <div>{t('reportsError')}</div>
    }

    const { summary, salesByDay, topProducts, salesByWorker, losses } = reportData;

    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-3xl font-bold text-foreground">{t('reportsTitle')}</h1>
                <p className="text-muted-foreground">{t('reportsDescription')}</p>
            </div>
            
            <div className="flex justify-end">
                 <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                        onClick={fetchReports}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? ( date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>{t('reportsSelectDate')}</span>)}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/>
                    </PopoverContent>
                </Popover>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('reportsGrossRevenue')}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">${summary.totalRevenue.toFixed(2)}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('reportsGrossProfit')}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">${summary.grossProfit.toFixed(2)}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('reportsStockCapital')}</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">${summary.stockCapital.toFixed(2)}</div></CardContent>
                </Card>
            </div>

             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>{t('reportsSalesByDay')}</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                       <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={salesByDay}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`}/>
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                                <Legend />
                                <Line type="monotone" dataKey="revenue" name={t('reportsChartRevenue')} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="profit" name={t('reportsChartProfit')} stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>{t('reportsTopProducts')}</CardTitle>
                        <CardDescription>{t('reportsTopProductsDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('reportsProductColumn')}</TableHead>
                                    <TableHead className="text-right">{t('reportsRevenueColumn')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {topProducts.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Image src={product.image} alt={product.name} width={40} height={40} className="rounded-md object-cover bg-muted" />
                                            <div>
                                                <p className="font-medium">{product.name}</p>
                                                <p className="text-xs text-muted-foreground">{t('reportsSoldLabel')}: {product.quantity}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">${product.revenue.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>{t('reportsSellerPerformance')}</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>{t('reportsSellerColumn')}</TableHead><TableHead className="text-right">{t('reportsSalesColumn')}</TableHead></TableRow></TableHeader>
                            <TableBody>{salesByWorker.map(worker => (<TableRow key={worker.id}><TableCell className="font-medium">{worker.name}</TableCell><TableCell className="text-right font-semibold">${worker.sales.toFixed(2)}</TableCell></TableRow>))}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>{t('reportsStockLosses')}</CardTitle></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader><TableRow><TableHead>{t('reportsProductColumn')}</TableHead><TableHead className="text-right">{t('reportsLossColumn')}</TableHead></TableRow></TableHeader>
                            <TableBody>{losses.map(loss => (<TableRow key={loss.id}><TableCell className="font-medium">{loss.productName}</TableCell><TableCell className="text-right font-semibold text-destructive">-${loss.lossValue.toFixed(2)}</TableCell></TableRow>))}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>


        </div>
    );
}
