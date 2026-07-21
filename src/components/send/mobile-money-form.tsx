
'use client';

import { useForm, useWatch, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { User, Country } from '@/lib/types';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { verifyAirtelAccountHolder } from '@/services/airtel';
import { verifyMpesaAccountHolder } from '@/services/mpesa';
import { debounce } from 'lodash';
import { Loader2, UserCheck } from 'lucide-react';
import Image from 'next/image';

const mobileMoneySchema = z.object({
  recipientName: z.string().min(3, "Le nom du bénéficiaire est requis."),
  recipientPhone: z.string().min(9, "Le numéro de téléphone est requis."),
  mobileMoneyOperator: z.enum(['airtel', 'orange', 'mpesa'], { required_error: "Veuillez sélectionner un opérateur." }),
  destinationCountry: z.string({ required_error: "Veuillez sélectionner un pays." }),
});

const airtelCountries = [
    'BF', 'CD', 'CG', 'GA', 'KE', 'MG', 'MW', 'NE', 'NG', 'RW', 'SC', 'SL', 'TD', 'TZ', 'UG', 'ZM'
];
const mpesaCountries = ['CD', 'KE', 'TZ', 'MZ', 'LS', 'GH'];


export function MobileMoneyForm({ control, countries }: { control: any, countries: Country[] }) {
    
    const { setValue, setError, clearErrors } = useFormContext();
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedName, setVerifiedName] = useState<string | null>(null);

    const recipientPhoneValue = useWatch({ control, name: 'recipientPhone' });
    const operatorValue = useWatch({ control, name: 'mobileMoneyOperator' });
    const destinationCountry = useWatch({ control, name: 'destinationCountry' });
    
    const dialCode = useMemo(() => {
        return countries.find(c => c.code === destinationCountry)?.dial_code || '';
    }, [destinationCountry, countries]);
    
    const availableOperators = useMemo(() => {
        if (!destinationCountry) return [];
        const operators = [];
        if (airtelCountries.includes(destinationCountry)) operators.push({ id: 'airtel', name: 'Airtel Money' });
        if (mpesaCountries.includes(destinationCountry)) operators.push({ id: 'mpesa', name: 'M-Pesa' });
        // Add Orange Money when ready
        // if (orangeCountries.includes(destinationCountry)) operators.push({ id: 'orange', name: 'Orange Money' });
        return operators;
    }, [destinationCountry]);

    const debouncedVerify = useCallback(debounce(async (phone: string, fullPhoneNumber: string) => {
        if (!phone || phone.length < 9 || !operatorValue) {
            setVerifiedName(null);
            clearErrors('recipientPhone');
            return;
        }
        
        setIsVerifying(true);
        let result;
        if (operatorValue === 'airtel') {
            result = await verifyAirtelAccountHolder(fullPhoneNumber);
        } else if (operatorValue === 'mpesa') {
            result = await verifyMpesaAccountHolder(phone, `vodacom${destinationCountry}`);
        } else {
            setIsVerifying(false);
            return; // No verification for other operators yet
        }

        if (result.success && result.name) {
            setVerifiedName(result.name);
            setValue('recipientName', result.name, { shouldValidate: true });
            clearErrors('recipientPhone');
        } else {
            setVerifiedName(null);
            setError('recipientPhone', { type: 'manual', message: result.error || 'Numéro invalide ou non trouvé.' });
        }
        setIsVerifying(false);
    }, 500), [setValue, setError, clearErrors, operatorValue, destinationCountry]);

    useEffect(() => {
        const fullPhoneNumber = `${dialCode}${recipientPhoneValue}`;
        debouncedVerify(recipientPhoneValue, fullPhoneNumber);
        return () => debouncedVerify.cancel();
    }, [recipientPhoneValue, dialCode, debouncedVerify]);
    
    useEffect(() => {
        setVerifiedName(null);
        setValue('recipientName', '');
        clearErrors('recipientPhone');
        // Check if the current operator is still valid for the new country
        const currentOperatorIsValid = availableOperators.some(op => op.id === operatorValue);
        if (!currentOperatorIsValid && availableOperators.length > 0) {
            setValue('mobileMoneyOperator', availableOperators[0].id);
        } else if (availableOperators.length === 0) {
            setValue('mobileMoneyOperator', undefined);
        }
    }, [operatorValue, destinationCountry, setValue, clearErrors, availableOperators]);

    return (
        <div className="space-y-6">
            <FormField
                control={control}
                name="destinationCountry"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Pays du bénéficiaire</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez un pays"/></SelectTrigger></FormControl>
                            <SelectContent>
                                {countries.filter(c => airtelCountries.includes(c.code) || mpesaCountries.includes(c.code)).map(country => (
                                    <SelectItem key={country.code} value={country.code}>
                                        <div className="flex items-center gap-2">
                                            <Image src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`} width={20} height={15} alt={country.name || ""}/>
                                            <span>{country.name} ({country.dial_code})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={control}
                name="mobileMoneyOperator"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Opérateur Mobile Money du bénéficiaire</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={!destinationCountry || availableOperators.length === 0}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Sélectionnez un opérateur" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {availableOperators.map(op => (
                                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                                ))}
                                <SelectItem value="orange" disabled>Orange Money (Bientôt)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name="recipientPhone"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Numéro de téléphone du bénéficiaire</FormLabel>
                         <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <span className="text-gray-500 text-sm">{dialCode}</span>
                            </div>
                            <FormControl><Input type="tel" placeholder="81..." {...field} className="pl-16"/></FormControl>
                            {isVerifying && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
            {verifiedName && (
                <div>
                    <FormLabel>Nom du bénéficiaire (vérifié)</FormLabel>
                    <div className="flex items-center gap-2 mt-2 p-3 bg-muted rounded-md">
                        <UserCheck className="h-5 w-5 text-green-500"/>
                        <p className="font-semibold">{verifiedName}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
