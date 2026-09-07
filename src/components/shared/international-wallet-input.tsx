
'use client';

import { useState } from 'react';
import { type ControllerRenderProps, type FieldValues, type FieldPath, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form';
import { Search, Loader2, UserCheck, QrCode, CheckCircle } from 'lucide-react';
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

/**
 * Standardized Wallet Input - Requires explicit user action to verify.
 * No auto-calls or debounce to ensure maximum rendering stability.
 */
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
    
    const handleManualVerify = async () => {
        const walletId = field.value;
        if (!walletId || walletId.length < 12) {
            if (setError && field?.name) setError(field.name, { type: 'manual', message: 'ID de portefeuille incomplet (12 caractères requis).' });
            return;
        }

        setIsVerifying(true);
        setVerifiedRecipient(null);
        
        try {
            const result = await getWalletInfo(walletId);
            setIsVerifying(false);
            
            if (result.success) {
                setVerifiedRecipient(result);
                onVerificationResult(result);
                if (clearErrors && field?.name) clearErrors(field.name);
            } else {
                setVerifiedRecipient(null);
                onVerificationResult(null);
                if (setError && field?.name) setError(field.name, { type: 'manual', message: result.error || 'Portefeuille non trouvé.' });
            }
        } catch (e) {
            setIsVerifying(false);
            if (setError && field?.name) setError(field.name, { type: 'manual', message: 'Erreur de connexion serveur.' });
        }
    };

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        field.onChange(newValue);
        // Si l'utilisateur modifie le champ, on réinitialise la validation
        if (verifiedRecipient) {
            setVerifiedRecipient(null);
            onVerificationResult(null);
        }
    };
    
    const handleScanSuccess = (scannedText: string) => {
        field.onChange(scannedText);
        setIsScannerOpen(false);
        // On pourrait lancer la vérification automatiquement après un scan QR
    };
    
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
                        className="pr-10 font-mono tracking-widest h-12"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {verifiedRecipient?.success && <UserCheck className="h-4 w-4 text-green-500" />}
                    </div>
                </div>
                 <button 
                    type="button" 
                    title="Vérifier le portefeuille"
                    className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 border transition-colors shrink-0"
                    onClick={handleManualVerify}
                    disabled={isVerifying}
                >
                    {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                 </button>
                 <button 
                    type="button" 
                    title="Scanner un QR Code"
                    className="flex h-12 w-12 items-center justify-center rounded-lg border bg-background hover:bg-muted shrink-0 transition-colors" 
                    onClick={() => setIsScannerOpen(true)}
                 >
                    <QrCode className="h-5 w-5" />
                 </button>
            </div>
             {verifiedRecipient?.success && (
                <div className="text-xs text-green-600 mt-1 flex items-center gap-2 px-1 py-0.5 bg-green-50 rounded w-fit">
                    <CheckCircle className="h-3 w-3" />
                    <span className="font-bold">{verifiedRecipient.userName}</span>
                    {countryDetails && <Image src={`https://flagcdn.com/w20/${countryDetails.code.toLowerCase()}.png`} width={16} height={12} alt={countryDetails.name} className="rounded-sm shadow-sm" />}
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
