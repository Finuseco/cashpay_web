'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { africanCountries, internationalMethods } from '@/lib/payment-methods';
import { MobileMoneyDepositForm } from './mobile-money-deposit-form';
import { CardDepositForm } from './card-deposit-form';
import { PayPalDepositForm } from './paypal-deposit-form';
import { initiateDeposit, initiateCardDeposit, checkDepositStatus } from '@/lib/actions/deposit.actions';
import { DepositStatusDialog } from './deposit-status-dialog';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';

interface DepositClientProps {
  user: User;
}

export function DepositClient({ user }: DepositClientProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactionRef, setTransactionRef] = useState<string | null>(null);
  const [status, setStatus] = useState<'pending' | 'success' | 'failed' | null>(null);

  // Filtrage local immédiat sans appel serveur
  const filteredCountries = africanCountries.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFormSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      let result;
      // L'appel backend ne survient qu'ici, lors de la soumission réelle
      if (selectedMethod === 'card') {
        result = await initiateCardDeposit({ ...data, user });
      } else {
        const [countryCode, operator] = selectedMethod.split(':');
        result = await initiateDeposit({
          ...data,
          user,
          countryCode,
          operator,
          paymentMethod: operator
        });
      }

      if (result.success && result.transactionId) {
        setTransactionRef(result.transactionId);
        setStatus('pending');
      } else {
        toast({ title: t('error'), description: result.error || t('errorInternal'), variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderSelectedForm = () => {
    if (!selectedMethod) return null;

    if (selectedMethod === 'card') {
      return <CardDepositForm user={user} onSubmit={handleFormSubmit} isSubmitting={isLoading} />;
    }
    if (selectedMethod === 'paypal') {
      return <PayPalDepositForm user={user} onSubmit={handleFormSubmit} isSubmitting={isLoading} />;
    }

    // Extraction des données locales pour le formulaire Mobile Money
    const [countryCode, operator] = selectedMethod.split(':');
    const country = africanCountries.find(c => c.code === countryCode);

    if (!country) return null;

    return (
      <div className="mt-6 pt-6 border-t border-dashed">
        <MobileMoneyDepositForm
          user={user}
          country={country}
          operator={operator}
          onSubmit={handleFormSubmit}
          isSubmitting={isLoading}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>{t('depositTitle', 'Approvisionnement de compte')}</CardTitle>
          <CardDescription>{t('depositDescription', 'Sélectionnez un opérateur pour continuer.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Input
            placeholder={t('depositSearchPlaceholder', 'Rechercher un pays...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />

          <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod} className="space-y-6">
            {filteredCountries.map((country) => (
              <div key={country.code} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {country.methods.map((method) => {
                    const value = `${country.code}:${method}`;
                    return (
                      <div key={value}>
                        <RadioGroupItem value={value} id={value} className="peer sr-only" />
                        <Label
                          htmlFor={value}
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-20 text-center"
                        >
                          <span className="text-xs font-bold">{method}</span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-3">
              <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {internationalMethods.name}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {internationalMethods.methods.map((method) => {
                  const value = method.toLowerCase().replace(/\s/g, '_');
                  return (
                    <div key={value}>
                      <RadioGroupItem value={value} id={value} className="peer sr-only" />
                      <Label
                        htmlFor={value}
                        className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-20 text-center"
                      >
                        <span className="text-xs font-bold">{method}</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </RadioGroup>

          {renderSelectedForm()}
        </CardContent>
      </Card>

      <DepositStatusDialog
        open={!!status}
        status={status === 'pending' ? 'pending_confirmation' : (status as any)}
        reference={transactionRef}
        instructions={null}
        onClose={() => { setStatus(null); setTransactionRef(null); }}
        onSuccess={() => window.location.href = '/transactions'}
        checkStatusAction={async (ref) => {
            const res = await checkDepositStatus(ref);
            return { success: res.success, status: res.status, message: res.message || '' };
        }}
      />
    </div>
  );
}
