

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { User, Currency, Country } from "@/lib/types";
import { requestInternationalTransfer } from '@/lib/actions/transfer.actions';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { Loader2, ArrowLeft, Send, CheckCircle, UserCheck, ShieldAlert, ArrowDown, Info } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Separator } from '../ui/separator';
import { Form, FormControl, FormField, FormMessage, FormItem, FormLabel } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { InternationalTransferReceipt } from './international-transfer-receipt';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import type { TransferTypeOption } from './transfer-options';
import { MobileMoneyForm } from './mobile-money-form';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { countryToCode } from '@/lib/utils';
import { getExchangeRatesForCountry, type ExchangeRate } from '@/lib/actions/exchange.actions';


type Step = 'details' | 'confirm_pin';
type IntlTransferType = Exclude<TransferTypeOption, 'national' | 'mobile_money'>;

interface SendDetails {
    amountToSend: number;
    currency: string;
    fee: number;
    totalDebit: number;
    debitCurrency: string;
    exchangeRate?: number;
    recipientReceives?: number;
    recipientName?: string;
    recipientCountry?: string;
    recipientPhone?: string;
    recipientCardNumber?: string;
    mobileMoneyOperator?: 'airtel' | 'orange' | 'mpesa';
}

const detailsSchema = z.object({
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Le montant doit être un nombre positif." }),
  paymentCurrency: z.string({ required_error: "Veuillez sélectionner un portefeuille." }),
  
  destinationCountry: z.string({ required_error: "Le pays de destination est requis." }),
  recipientName: z.string({ required_error: "Le nom du destinataire est requis." }),
  recipientPhone: z.string().optional(),
  recipientCardNumber: z.string().optional(),
  
  notifyRecipientSms: z.boolean().default(true).optional(),
});

const pinSchema = z.object({
  pin: z.string().min(4, "Le PIN doit contenir 4 chiffres."),
});

interface InternationalTransferSendFormProps {
    user: User;
    currencies: Currency[];
    countries: Country[];
    provider: IntlTransferType;
    onBack: () => void;
}

export function InternationalTransferSendForm({ user, currencies, countries, provider, onBack }: InternationalTransferSendFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  
  const [step, setStep] = useState<Step>('details');
  const [sendDetails, setSendDetails] = useState<SendDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSuccessfulTransfer, setLastSuccessfulTransfer] = useState<{ details: SendDetails, reference: string } | null>(null);
  const [fee, setFee] = useState(0);
  const [insufficientBalance, setInsufficientBalance] = useState<string | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [recipientAmount, setRecipientAmount] = useState<{amount: number, currency: string} | null>(null);
  const [exchangeRateInfo, setExchangeRateInfo] = useState<string | null>(null);

  const form = useForm<z.infer<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
    mode: 'onChange',
    defaultValues: {
      paymentCurrency: 'USD',
      amount: '',
      destinationCountry: '',
      recipientName: '',
      recipientPhone: '',
      recipientCardNumber: '',
      notifyRecipientSms: true,
    },
  });

  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });
  
  const watchedAmount = form.watch('amount');
  const watchedPaymentCurrency = form.watch('paymentCurrency');
  const watchedDestinationCountry = form.watch('destinationCountry');
  const amountNum = parseFloat(watchedAmount);

  const fetchRates = useCallback(async (countryCode: string | null) => {
    if (!countryCode) return;
    const rates = await getExchangeRatesForCountry(countryCode);
    setExchangeRates(rates);
  }, []);

  useEffect(() => {
    fetchRates(watchedDestinationCountry);
  }, [watchedDestinationCountry, fetchRates]);

  useEffect(() => {
    const calculateFeeAndBalance = async () => {
        if (amountNum > 0 && watchedPaymentCurrency && user.country) {
            const countryCode = user.country;
            const calculatedFee = await calculateTransactionFee(amountNum, watchedPaymentCurrency, 'INTL_SEND', countryCode);
            setFee(calculatedFee);

            const balance = parseFloat(String(currencies.find(c => c.code === watchedPaymentCurrency)?.balance || '0').replace(/,/g, ''));
            if (balance < (amountNum + calculatedFee)) {
                setInsufficientBalance(`Solde insuffisant. Requis: ${(amountNum + calculatedFee).toFixed(2)} ${watchedPaymentCurrency}, disponible: ${balance.toFixed(2)} ${watchedPaymentCurrency}`);
            } else {
                setInsufficientBalance(null);
            }

            // Calculate recipient amount based on destination country
            const destCountryInfo = countries.find(c => c.code === watchedDestinationCountry);
            const destCurrency = destCountryInfo?.currency_code;
            if (destCurrency && destCurrency !== watchedPaymentCurrency) {
                 const rateData = exchangeRates.find(r => r.from_currency === watchedPaymentCurrency && r.to_currency === destCurrency);
                 if (rateData) {
                    setRecipientAmount({ amount: amountNum * rateData.rate, currency: destCurrency });
                    setExchangeRateInfo(`1 ${watchedPaymentCurrency} ≈ ${rateData.rate.toFixed(2)} ${destCurrency}`);
                 } else {
                    setRecipientAmount(null);
                    setExchangeRateInfo(null);
                 }
            } else {
                 setRecipientAmount({ amount: amountNum, currency: watchedPaymentCurrency });
                 setExchangeRateInfo(null);
            }

        } else {
            setFee(0);
            setInsufficientBalance(null);
            setRecipientAmount(null);
            setExchangeRateInfo(null);
        }
    }
    calculateFeeAndBalance();
  }, [watchedAmount, watchedPaymentCurrency, watchedDestinationCountry, currencies, user.country, amountNum, exchangeRates]);

  const handleDetailsSubmit = async (values: z.infer<typeof detailsSchema>) => {
    if (insufficientBalance) {
        openAlert({ title: "Solde insuffisant", description: insufficientBalance, variant: "error" });
        return;
    }
    
    const amountNum = parseFloat(values.amount);

    setSendDetails({
        amountToSend: amountNum,
        currency: values.paymentCurrency,
        fee: fee,
        totalDebit: amountNum + fee,
        debitCurrency: values.paymentCurrency,
        recipientName: values.recipientName,
        recipientCountry: values.destinationCountry,
        recipientPhone: values.recipientPhone,
        recipientCardNumber: values.recipientCardNumber,
        recipientReceives: recipientAmount?.amount,
        exchangeRate: exchangeRateInfo ? parseFloat(exchangeRateInfo.split('≈')[1].trim().split(' ')[0]) : undefined,
    });
    setStep('confirm_pin');
  };
  
  const handleFinalSubmit = async (pinValues: z.infer<typeof pinSchema>) => {
    if (!sendDetails) return;

    setIsSubmitting(true);
    
    const pinVerificationResult = await verifyCurrentUserPin(pinValues.pin);
    if (!pinVerificationResult.success) {
      openAlert({ variant: "error", title: "Code PIN Incorrect", description: pinVerificationResult.error || "Le code PIN est incorrect." });
      setIsSubmitting(false);
      pinForm.reset();
      return;
    }
    
    const result = await requestInternationalTransfer({
        user: user, provider, recipientName: sendDetails.recipientName!, recipientCountry: sendDetails.recipientCountry!,
        amount: sendDetails.amountToSend, currency: sendDetails.debitCurrency, fee: sendDetails.fee,
        recipientPhone: sendDetails.recipientPhone, notifyRecipientSms: form.getValues('notifyRecipientSms') || false,
        recipientCardNumber: sendDetails.recipientCardNumber,
    });
    
    if (result.success && result.reference) {
      setLastSuccessfulTransfer({ details: sendDetails, reference: result.reference });
    } else {
      openAlert({ variant: "error", title: "Erreur de Transfert", description: result.error });
    }
    setIsSubmitting(false);
  };

  const resetFlow = () => {
    setStep('details');
    setSendDetails(null);
    setLastSuccessfulTransfer(null);
    form.reset({ paymentCurrency: 'USD', amount: '', destinationCountry: '', recipientName: '', recipientPhone: '', recipientCardNumber: '' });
    pinForm.reset();
  };
  
  if (step === 'confirm_pin' && sendDetails) {
    const debitSymbol = currencies.find(c => c.code === sendDetails.currency)?.symbol || '$';
    return (
        <Card>
            <CardHeader>
              <Button variant="ghost" size="icon" className="absolute top-3 left-3" onClick={() => setStep('details')}>
                  <ArrowLeft className="h-5 w-5"/>
              </Button>
              <CardTitle className="text-center pt-2">{t('confirmTransferTitle')}</CardTitle>
              <CardDescription className="text-center">{t('confirmTransferDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-6 p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">{t('recipientLabel')}</span><span className="font-semibold">{sendDetails.recipientName}</span></div>
                    {sendDetails.recipientCountry && <div className="flex justify-between items-center"><span className="text-muted-foreground">{t('countryLabel')}</span><span className="font-semibold">{countries.find(c => c.code === sendDetails.recipientCountry)?.name}</span></div>}
                    <Separator className="my-2"/>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">{t('sendMoneySummaryAmount')}</span><span className="font-semibold">{debitSymbol}{sendDetails.amountToSend.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">{t('sendMoneySummaryFee')}</span><span className="font-semibold">{debitSymbol}{sendDetails.fee.toFixed(2)}</span></div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between items-center text-lg font-bold"><span>{t('sendMoneySummaryTotal')}</span><span>{debitSymbol}{sendDetails.totalDebit.toFixed(2)}</span></div>
                </div>
                 <Form {...pinForm}>
                    <form onSubmit={pinForm.handleSubmit(handleFinalSubmit)} className="space-y-6">
                       <FormField control={pinForm.control} name="pin" render={({ field }) => (<FormItem><FormLabel>{t('securityPinLabel')}</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage /></FormItem>)}/>
                        <div className="flex flex-col-reverse sm:flex-row gap-4">
                            <Button type="button" variant="outline" className="w-full" onClick={() => setStep('details')}><ArrowLeft className="mr-2 h-4 w-4" />{t('backButton')}</Button>
                            <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {t('confirmAndSendButton')}
                        </Button>
                        </div>
                  </form>
              </Form>
            </CardContent>
        </Card>
    );
  }

  return (
    <>
      <Dialog open={!!lastSuccessfulTransfer} onOpenChange={(isOpen) => { if(!isOpen) resetFlow() }}>
        <DialogContent>
            {lastSuccessfulTransfer && user && (
                <InternationalTransferReceipt 
                    details={lastSuccessfulTransfer.details}
                    reference={lastSuccessfulTransfer.reference}
                    sender={user}
                />
            )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <Button variant="ghost" size="icon" className="absolute top-3 left-3" onClick={onBack}>
            <ArrowLeft className="h-5 w-5"/>
          </Button>
          <CardTitle className="text-center pt-2">{t(`transferTypeTitle${provider.charAt(0).toUpperCase() + provider.slice(1)}` as any, 'Transfert International')}</CardTitle>
          <CardDescription className="text-center">{t('transferDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
           <Form {...form}>
              <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-6">
                <FormField control={form.control} name="destinationCountry" render={({ field }) => ( <FormItem><FormLabel>{t('transferDestinationCountryLabel')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('transferDestinationCountryPlaceholder')}/></SelectTrigger></FormControl><SelectContent>{countries.map(country => (<SelectItem key={country.code} value={country.code}><div className="flex items-center gap-2"><Image src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`} width={20} height={15} alt={country.name || ""}/><span>{country.name} ({country.currency_code})</span></div></SelectItem>))}</SelectContent></Select><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="recipientName" render={({ field }) => (<FormItem><FormLabel>{t('transferRecipientNameLabel')}</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="recipientPhone" render={({ field }) => (<FormItem><FormLabel>{t('transferRecipientPhoneLabel')}</FormLabel><FormControl><Input placeholder="+243..." {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>{t('transferAmountLabel')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem> )} />
                 <FormField control={form.control} name="paymentCurrency" render={({ field }) => (<FormItem><FormLabel>{t('transferSendFromLabel')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('transferSelectWalletPlaceholder')} /></SelectTrigger></FormControl><SelectContent>{currencies.filter(c => c.code === 'USD' || c.code === 'EUR').map((currency) => (<SelectItem key={currency.code} value={currency.code}>{currency.code} ({currency.symbol}{currency.balance})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                 
                 {recipientAmount && (
                    <div className="flex flex-col items-center justify-center space-y-2 py-2">
                        <ArrowDown className="h-6 w-6 text-muted-foreground" />
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">{t('recipientReceivesLabel')}</p>
                            <p className="text-2xl font-bold">{recipientAmount.currency} {recipientAmount.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            {exchangeRateInfo && <p className="text-xs text-muted-foreground">{exchangeRateInfo}</p>}
                        </div>
                    </div>
                )}
                 
                 {fee > 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                        Frais de transaction : <span className="font-semibold">{fee.toFixed(2)} {watchedPaymentCurrency}</span>. Total à débiter : <span className="font-semibold">{(amountNum + fee).toFixed(2)} {watchedPaymentCurrency}</span>
                    </p>
                 )}

                 {insufficientBalance && (
                    <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Solde insuffisant</AlertTitle>
                        <AlertDescription>{insufficientBalance}</AlertDescription>
                    </Alert>
                )}

                 <Button type="submit" variant="gradient" className="w-full font-bold" disabled={!form.formState.isValid || !!insufficientBalance}>
                     {t('continueButton')}
                 </Button>
              </form>
            </Form>
        </CardContent>
     </Card>
   </>
  );
}
