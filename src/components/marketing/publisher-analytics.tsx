
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart as ChartIcon, Pointer, DollarSign, TrendingUp, Globe, Target, Dices, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { getPublisherAnalyticsData, type PublisherAnalyticsData, claimPublisherEarnings } from '@/lib/actions/analytics.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Skeleton } from '../ui/skeleton';
import Image from 'next/image';
import { countries } from '@/lib/countries';
import { Button } from '../ui/button';
import { Dialog, DialogHeader, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Loader2 } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const ClaimDialog = ({ revenue, onClaim }: { revenue: number, onClaim: (type: 'claim' | 'double' | 'triple') => void }) => {
    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Récupérer vos Gains</DialogTitle>
                <DialogDescription>
                    Vous avez accumulé ${revenue.toFixed(2)}. Choisissez une option ci-dessous.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <Button className="w-full h-20" variant="outline" onClick={() => onClaim('claim')}>
                    <div className="text-left">
                        <p className="font-bold text-lg">Récupérer ${revenue.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Transfert sécurisé vers votre portefeuille principal.</p>
                    </div>
                </Button>
                <Button className="w-full h-20" variant="outline" onClick={() => onClaim('double')}>
                    <div className="text-left">
                        <p className="font-bold text-lg flex items-center gap-2"><Dices /> Tenter de Doubler</p>
                        <p className="text-xs text-muted-foreground">50% de chance de gagner ${ (revenue * 2).toFixed(2)}, 50% de chance de tout perdre.</p>
                    </div>
                </Button>
                <Button className="w-full h-20" variant="outline" onClick={() => onClaim('triple')}>
                     <div className="text-left">
                        <p className="font-bold text-lg flex items-center gap-2"><Target/> Tenter de Tripler</p>
                        <p className="text-xs text-muted-foreground">33% de chance de gagner ${(revenue * 3).toFixed(2)}, 67% de chance de tout perdre.</p>
                    </div>
                </Button>
            </div>
        </DialogContent>
    )
};


const LoadingSkeleton = () => (
     <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-80 w-full rounded-lg" />
            <Skeleton className="h-80 w-full rounded-lg" />
        </div>
    </div>
);

export function PublisherAnalytics() {
    const [analyticsData, setAnalyticsData] = useState<PublisherAnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);
    const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
    const { openAlert } = useAlertDialog();

    useEffect(() => {
        const fetchData = async () => {
            const user = await getAuthenticatedUser();
            if (user) {
                const data = await getPublisherAnalyticsData(user.id);
                setAnalyticsData(data);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleClaim = async (type: 'claim' | 'double' | 'triple') => {
        const user = await getAuthenticatedUser();
        const baseAmount = analyticsData?.summary.revenue || 0;
        if (!user || baseAmount < 70) return;
        
        setIsClaiming(true);
        setIsClaimDialogOpen(false);
        
        const result = await claimPublisherEarnings(user.id, type, baseAmount);

        if (result.success) {
            openAlert({
                title: 'Opération Réussie !',
                description: result.message,
                variant: 'success'
            });
            // Refresh data after claim
            const data = await getPublisherAnalyticsData(user.id);
            setAnalyticsData(data);
        } else {
             openAlert({
                title: 'Opération Échouée',
                description: result.error,
                variant: 'error'
            });
        }

        setIsClaiming(false);
    };

    if (isLoading) {
        return <LoadingSkeleton />;
    }

    if (!analyticsData) {
        return <p className="text-muted-foreground">Impossible de charger les données analytiques.</p>;
    }
    
    const { impressions, clicks, revenue } = analyticsData.summary;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const canClaim = revenue >= 70;
    
    const countryNameMap = new Map(countries.map(c => [c.code, c.name]));


    return (
        <div className="space-y-6">
            <Dialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
                {canClaim && <ClaimDialog revenue={revenue} onClaim={handleClaim} />}
            </Dialog>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Impressions (30j)" value={impressions.toLocaleString()} icon={ChartIcon} />
                <StatCard title="Clics (30j)" value={clicks.toLocaleString()} icon={Pointer} />
                <StatCard title="Taux de Clics (CTR)" value={`${ctr.toFixed(2)}%`} icon={TrendingUp} />
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Revenus Estimés (30j)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${revenue.toFixed(2)}</div>
                        <Button size="sm" variant="secondary" className="mt-2 h-7" disabled={!canClaim || isClaiming} onClick={() => setIsClaimDialogOpen(true)}>
                            {isClaiming ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Récupérer les gains'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Performances par Jour</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.performanceByDay}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-2))" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="impressions" fill="hsl(var(--primary))" name="Impressions" radius={[4, 4, 0, 0]} />
                                <Bar yAxisId="right" dataKey="clicks" fill="hsl(var(--chart-2))" name="Clics" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5"/> Top 5 Pays</CardTitle>
                        <CardDescription>Les pays générant le plus d'impressions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pays</TableHead>
                                <TableHead className="text-right">Impressions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {analyticsData.topCountries.map(country => (
                                <TableRow key={country.country}>
                                    <TableCell className="flex items-center gap-2">
                                        <Image
                                            src={`https://flagcdn.com/w20/${country.country.toLowerCase()}.png`}
                                            alt={country.country}
                                            width={20}
                                            height={15}
                                        />
                                        {countryNameMap.get(country.country) || country.country}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{country.impressions.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                       </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
