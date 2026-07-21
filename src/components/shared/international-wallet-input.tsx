'use client';

import { useState, useCallback, useEffect } from 'react';
import { type ControllerRenderProps, type FieldValues, type FieldPath, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form';
import { Search, Loader2, UserCheck, QrCode } from 'lucide-react';
import { debounce } from 'lodash';
import { getWalletInfo } from '@/lib/actions/wallet.actions';
import type { WalletInfo } from '@/lib/actions/wallet.actions';
import { QrScannerDialog } from '@/components/shared/qr-scanner-dialog';
import { getCountryByCode } from '@/lib/utils';
import Image from 'next/image';

interface InternationalWalletInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
    field: ControllerRenderProps<TFieldValues, TName>; 
    label: string;
    placeholder?: string;
    onVerificationResult: (result: WalletInfo | null) => void;
    'data-testid'?: string;
}

export function InternationalWalletInput<TFieldValues extends FieldValues>({ 
    field,
    label,
    placeholder,
    onVerificationResult,
    'data-testid': dataTestId,
}: InternationalWalletInputProps<TFieldValues>) {
    const formContext = useFormContext();
    const setError = formContext?.setError;
    const clearErrors = formContext?.clearErrors;
    
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedRecipient, setVerifiedRecipient] = useState<WalletInfo | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    const debouncedVerify = useCallback(
        debounce(async (walletId: string) => {
            if (!walletId || walletId.length < 12) {
                setVerifiedRecipient(null);
                onVerificationResult(null);
                return;
            }

            setIsVerifying(true);
            const result = await getWalletInfo(walletId);
            setIsVerifying(false);
            onVerificationResult(result);

            if (result.success) {
                setVerifiedRecipient(result);
                if (clearErrors && field?.name) clearErrors(field.name);
            } else {
                setVerifiedRecipient(null);
                if (setError && field?.name) setError(field.name, { type: 'manual', message: result.error || 'Portefeuille non trouvé.' });
            }
        }, 500),
        [onVerificationResult, setError, clearErrors, field?.name]
    );

    useEffect(() => {
        debouncedVerify(field.value);
        return () => debouncedVerify.cancel();
    }, [field.value, debouncedVerify]);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value.toUpperCase();
        field.onChange(newValue);
    };
    
    const handleScanSuccess = (scannedText: string) => {
        field.onChange(scannedText);
        setIsScannerOpen(false);
    }
    
    const countryDetails = verifiedRecipient?.countryCode ? getCountryByCode(verifiedRecipient.countryCode) : null;

    return (
        <div className="space-y-2">
            <Label className="text-foreground">{label}</Label>
            <div className="flex items-center gap-2 mt-2">
                <div className="relative flex-grow">
                    <Input 
                        placeholder={placeholder} 
                        {...field}
                        onChange={handleOnChange}
                        data-testid={dataTestId}
                        className="pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isVerifying ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : verifiedRecipient?.success ? (
                            <UserCheck className="h-4 w-4 text-green-500" />
                        ) : null}
                    </div>
                </div>
                 <Button type="button" variant="outline" size="icon" onClick={() => setIsScannerOpen(true)}>
                    <QrCode className="h-5 w-5" />
                 </Button>
            </div>
             {verifiedRecipient?.success && (
                <div className="text-xs text-green-600 mt-1 flex items-center gap-2">
                    {verifiedRecipient.userName}
                    {countryDetails && <Image src={`https://flagcdn.com/w20/${countryDetails.code.toLowerCase()}.png`} width={20} height={15} alt={countryDetails.name}/>}
                </div>
            )}
             <FormMessage />
             
            <QrScannerDialog 
                open={isScannerOpen}
                onOpenChange={setIsScannerOpen}
                onScanSuccess={handleScanSuccess}
                mode="qr"
            />
        </div>
    );
}
