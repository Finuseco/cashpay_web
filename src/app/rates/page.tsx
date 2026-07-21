
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FullscreenToggle } from '@/components/ui/fullscreen-toggle';
import { ArrowRightLeft, Users, Globe } from 'lucide-react';
import type { Country } from '@/lib/types';
import type { ExchangeRate } from '@/lib/actions/exchange.actions';
import { getCountriesList } from '@/lib/actions/countries.actions';
import { getExchangeRatesForCountry } from '@/lib/actions/exchange.actions';
import { getUserCounts } from '@/lib/actions/user.actions';
import { Logo } from '@/components/logo';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicRatesPage() {
    const { t } = useTranslation();
    const [countries, setCountries] = useState<Country[]>([]);
    const [selectedCountryCode, setSelectedCountryCode] = useState('CD');
    const [rates, setRates] = useState<ExchangeRate[]>([]);
    const [stats, setStats] = useState<{ totalUsers: number; countryUsers: number }>({ totalUsers: 0, countryUsers: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const fetchRatesAndStats = useCallback(async (countryCode: string) => {
        setIsLoading(true);
        const [fetchedRates, fetchedStats] = await Promise.all([
            getExchangeRatesForCountry(countryCode),
            getUserCounts(countryCode)
        ]);
        setRates(fetchedRates);
        setStats(fetchedStats);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const init = async () => {
            const countryList = await getCountriesList();
            setCountries(countryList);
            await fetchRatesAndStats(selectedCountryCode);
        };
        init();
    }, [fetchRatesAndStats, selectedCountryCode]);
    
    const handleCountryChange = (code: string) => {
        setSelectedCountryCode(code);
    };

    return (
        <div className="bg-background min-h-screen p-4 sm:p-8 flex flex-col">
            <header className="flex justify-between items-center mb-6">
                <Logo className="h-12"/>
                <div className="flex items-center gap-2">
                    <Select onValueChange={handleCountryChange} defaultValue={selectedCountryCode}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sélectionner un pays" />
                        </SelectTrigger>
                        <SelectContent>
                            {countries.map(country => (
                                <SelectItem key={country.code} value={country.code}>
                                    {country.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FullscreenToggle />
                </div>
            </header>
            
            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-3">
                                <ArrowRightLeft className="text-primary"/>
                                Taux de Change en Temps Réel
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             {isLoading ? (
                                <div className="space-y-2">
                                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                                </div>
                            ) : (
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>De</TableHead>
                                        <TableHead>À</TableHead>
                                        <TableHead className="text-right">Taux</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rates.map(rate => (
                                        <TableRow key={`${rate.from_currency}-${rate.to_currency}`}>
                                            <TableCell className="font-semibold">{rate.from_currency}</TableCell>
                                            <TableCell className="font-semibold">{rate.to_currency}</TableCell>
                                            <TableCell className="font-mono text-right">{rate.rate.toFixed(6)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
                
                 <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-3"><Users/> Utilisateurs Totaux</CardTitle>
                        </CardHeader>
                         <CardContent>
                            {isLoading ? <Skeleton className="h-10 w-32"/> : (
                                <p className="text-4xl font-bold">{stats.totalUsers.toLocaleString()}</p>
                            )}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-3"><Globe/> Utilisateurs ({selectedCountryCode})</CardTitle>
                        </CardHeader>
                         <CardContent>
                            {isLoading ? <Skeleton className="h-10 w-24"/> : (
                                <p className="text-4xl font-bold">{stats.countryUsers.toLocaleString()}</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
            
            <footer className="text-center text-muted-foreground text-xs mt-8">
                Les taux sont fournis à titre indicatif et peuvent varier.
            </footer>
        </div>
    );
}
