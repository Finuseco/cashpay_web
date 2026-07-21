
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { 
    getCountryExchangeRates, 
    updateCountryExchangeRate 
} from '@/lib/actions/super-agent/finance.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { countryToCode, getCountryByCode, cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { User } from '@/lib/types';

export default function SuperAgentRates() {
    const [user, setUser] = useState<User | null>(null);
    const [rates, setRates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [localCurrency, setLocalCurrency] = useState('');
    const [countryCode, setCountryCode] = useState('');
    const { openAlert } = useAlertDialog();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const current = await getAuthenticatedUser();
        setUser(current);
        if (current?.country) {
            const code = countryToCode(current.country);
            if (code) {
                setCountryCode(code);
                const countryInfo = getCountryByCode(code);
                setLocalCurrency(countryInfo?.currency_code || '');
                
                const result = await getCountryExchangeRates(code);
                if (result.success) setRates(result.data || []);
            }
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRateChange = (index: number, value: string) => {
        const newRates = [...rates];
        newRates[index].rate = value;
        setRates(newRates);
    };

    const handleUpdate = async (rateObj: any) => {
        if (isRestricted) return;

        const rateKey = `${rateObj.from_currency}-${rateObj.to_currency}`;
        setIsSaving(rateKey);
        
        if (!user) return;

        const result = await updateCountryExchangeRate({
            userId: user.id,
            fromCurrency: rateObj.from_currency,
            toCurrency: rateObj.to_currency,
            countryCode: countryCode,
            newRate: parseFloat(rateObj.rate)
        });

        if (result.success) {
            openAlert({ title: 'Taux mis à jour', description: `Le taux ${rateKey} a été actualisé avec succès.`, variant: 'success' });
        } else {
            openAlert({ title: 'Action Refusée', description: result.error, variant: 'error' });
            fetchData(); 
        }
        setIsSaving(null);
    };

    const isInternationalPair = (from: string, to: string) => {
        const intl = ['USD', 'EUR'];
        return intl.includes(from) && intl.includes(to);
    };

    const isRestricted = user?.role === 'SubSuperAgent';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Gestion des Taux de Change</h1>
                    <p className="text-sm text-zinc-400">Ajustez les taux de conversion pour le marché {countryCode}.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}/> Actualiser
                </Button>
            </div>

            {isRestricted ? (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle className="font-bold uppercase tracking-tight">Accès Restreint</AlertTitle>
                    <AlertDescription className="text-xs">
                        En tant que Sous-Super Agent Provincial, vous avez uniquement un droit de consultation. Seul le Super Agent National est habilité à modifier la grille de conversion monétaire du pays.
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert className="bg-primary/5 border-primary/10 text-primary-foreground">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Règle de Souveraineté</AlertTitle>
                    <AlertDescription>
                        Vous pouvez modifier les taux entre votre devise locale (<strong>{localCurrency}</strong>) et les devises internationales (USD, EUR). 
                        Les taux directs entre USD et EUR sont gérés par le siège social.
                    </AlertDescription>
                </Alert>
            )}

            <Card className="bg-zinc-800 border-zinc-700 text-white shadow-xl">
                <CardHeader>
                    <CardTitle>Grille de Conversion Nationale</CardTitle>
                    <CardDescription className="text-zinc-400">Valeurs en vigueur pour toutes les transactions du pays.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700 hover:bg-transparent">
                                <TableHead className="text-zinc-400">De</TableHead>
                                <TableHead className="text-zinc-400">Vers</TableHead>
                                <TableHead className="text-zinc-400">Taux actuel</TableHead>
                                <TableHead className="text-right text-zinc-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : rates.length > 0 ? rates.map((rate, idx) => {
                                const isLocked = isInternationalPair(rate.from_currency, rate.to_currency);
                                const rateKey = `${rate.from_currency}-${rate.to_currency}`;
                                return (
                                    <TableRow key={rateKey} className="border-zinc-700 hover:bg-zinc-700/30">
                                        <TableCell className="font-bold">{rate.from_currency}</TableCell>
                                        <TableCell className="font-bold">{rate.to_currency}</TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                step="0.0001"
                                                value={rate.rate}
                                                disabled={isLocked || isSaving === rateKey || isRestricted}
                                                onChange={(e) => handleRateChange(idx, e.target.value)}
                                                className="w-32 bg-zinc-900 border-zinc-600 text-white font-mono"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isLocked ? (
                                                <Badge variant="outline" className="border-zinc-600 text-zinc-500">SIÈGE UNIQUEMENT</Badge>
                                            ) : (
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => handleUpdate(rate)}
                                                    disabled={isSaving === rateKey || isRestricted}
                                                    className={cn(isRestricted && "opacity-50 grayscale")}
                                                >
                                                    {isSaving === rateKey ? <Loader2 className="h-3 w-3 animate-spin"/> : <Save className="h-3 w-3 mr-1"/>}
                                                    Appliquer
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : <TableRow><TableCell colSpan={4} className="text-center py-10 text-zinc-500">Aucun taux configuré pour ce pays.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
