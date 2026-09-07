
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { createTransaction } from "@/lib/actions/transaction.actions";
import { Loader2, UserCheck, ShieldCheck, ArrowDown, Info, ShoppingCart } from "lucide-react";
import type { User, Currency, CartItem } from '@/lib/types';
import { getWalletInfo, type WalletInfo, calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { Skeleton } from "../ui/skeleton";
import { getExchangeRatesForCountry, type ExchangeRate } from "@/lib/actions/exchange.actions";
import { getCountryByCode, countryToCode, currentPrice, generateReferenceCode } from '@/lib/utils';
import Image from "next/image";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import { Separator } from "../ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { processQrSale } from "@/lib/actions/agent.actions";
import { useRouter } from 'next/navigation';
import { verifyCurrentUserPin } from "@/lib/actions/auth.actions";

// Helper to safely parse formatted balance strings (e.g. "1,250.75" -> 1250.75)
const parseBalance = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const cleanVal = val.replace(/,/g, '');
    const num = parseFloat(cleanVal);
    return isNaN(num) ? 0 : num;
};

const detailsSchema = z.object({
  paymentCurrency: z.string({ required_error: 'Veuillez sélectionner un portefeuille pour payer.'}),
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

interface PaymentConfirmationFormProps {
  user: User | null;
  paymentData: { 
    type?: 'POS_SALE' | 'PAYMENT_REQUEST';
    saleReference?: string;
    sellerWalletId?: string;
    amount: number; 
    currency: string; 
    recipient?: string;
    items?: CartItem[];
    sellerName?: string;
    boutiqueName?: string;
  };
  userCurrencies: Currency[];
  onSuccess: () => void;
}

export function PaymentConfirmationForm({ user, paymentData, userCurrencies, onSuccess }: PaymentConfirmationFormProps) {
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  
  const [fee, setFee] = useState(0);
  
  const finalAmount = useMemo(() => {
    let amount = 0;
    if (paymentData.type === 'POS_SALE' && paymentData.items && paymentData.items.length > 0) {
      amount = paymentData.items.reduce((sum, item) => {
          const itemPrice = Number(item.sellingPrice || (item as any).price || 0);
          const qty = Number(item.quantity || 0);
          return sum + (itemPrice * qty);
      }, 0);
    } else {
      amount = Number(paymentData.amount) || 0;
    }
    return isNaN(amount) ? 0 : amount;
  }, [paymentData]);

  const [debitedAmount, setDebitedAmount] = useState(finalAmount);
  
  const detailsForm = useForm<z.infer<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { 
        paymentCurrency: userCurrencies.find(c => c.code === paymentData.currency)?.code || userCurrencies[0]?.code || 'USD'
    },
  });

  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });

  const paymentCurrency = detailsForm.watch('paymentCurrency');
  const recipientWalletId = paymentData.type === 'POS_SALE' ? paymentData.sellerWalletId : paymentData.recipient;
  
  const positiveBalanceCurrencies = useMemo(() => {
    return userCurrencies.filter(c => parseBalance(c.balance) > 0);
  }, [userCurrencies]);

  const calculateAmounts = useCallback(async () => {
    if (!user || !user.country) return;

    // We treat every scan payment as a transfer/payment for fee purposes
    const transactionType = paymentData.type === 'POS_SALE' ? 'POS_SALE' : 'PAYMENT';
    
    let finalDebitedAmount = Number(finalAmount || 0);
    let conversionRate = 1;

    // Dynamic conversion logic using SENDER'S country rates
    if (paymentCurrency !== paymentData.currency) {
        const rateObj = exchangeRates.find(r => r.from_currency === paymentData.currency && r.to_currency === paymentCurrency);
        if (rateObj) {
            conversionRate = rateObj.rate;
            finalDebitedAmount = Number(finalAmount) * conversionRate;
        }
    }

    const calculatedFee = await calculateTransactionFee(finalDebitedAmount, paymentCurrency, transactionType, user.country);
    
    setDebitedAmount(isNaN(finalDebitedAmount) ? 0 : finalDebitedAmount);
    setFee(isNaN(calculatedFee) ? 0 : calculatedFee);
  }, [finalAmount, paymentData.currency, paymentCurrency, exchangeRates, user, paymentData.type]);

  useEffect(() => {
    const fetchInitialData = async () => {
        if (!recipientWalletId || !user) {
            onSuccess();
            return;
        }
        setIsLoading(true);
        const [info, rates] = await Promise.all([
            getWalletInfo(recipientWalletId),
            getExchangeRatesForCountry(countryToCode(user.country))
        ]);

        if (info.success) {
            setRecipientInfo(info);
            setExchangeRates(rates);
        } else {
            openAlert({ title: t('payFailedTitle'), description: info.error || "Destinataire invalide.", variant: 'error'});
            onSuccess();
        }
        setIsLoading(false);
    };
    fetchInitialData();
  }, [recipientWalletId, openAlert, t, onSuccess, user]);
  
  useEffect(() => {
    const autoSelectCurrency = async () => {
      if (isLoading || !user?.country) return;
      
      const transactionType = paymentData.type === 'POS_SALE' ? 'POS_SALE' : 'PAYMENT';
      const requiredInDefaultCurrency = finalAmount; // Approximate, ignoring fee for first pass
      const defaultCurrencyBalance = parseBalance(userCurrencies.find(c => c.code === paymentData.currency)?.balance);

      if (defaultCurrencyBalance < requiredInDefaultCurrency) {
        for (const altCurrency of positiveBalanceCurrencies) {
          if (altCurrency.code === paymentData.currency) continue;

          const rate = exchangeRates.find(r => r.from_currency === paymentData.currency && r.to_currency === altCurrency.code)?.rate;
          if (rate) {
            const requiredInAltCurrency = requiredInDefaultCurrency * rate;
            const altBalance = parseBalance(altCurrency.balance);
            if (altBalance >= requiredInAltCurrency) {
              detailsForm.setValue('paymentCurrency', altCurrency.code);
              return;
            }
          }
        }
      } else {
          detailsForm.setValue('paymentCurrency', paymentData.currency);
      }
    };
    autoSelectCurrency();
  }, [isLoading, user, finalAmount, paymentData, userCurrencies, exchangeRates, detailsForm, positiveBalanceCurrencies]);


  useEffect(() => {
    calculateAmounts();
  }, [calculateAmounts]);


  const handleOpenPinDialog = (values: z.infer<typeof detailsSchema>) => {
    setIsPinDialogOpen(true);
  }

  async function handlePinConfirm(values: z.infer<typeof pinSchema>) {
    if (!user || !recipientInfo?.success) {
      openAlert({ variant: "error", title: t('payFailedTitle'), description: "Utilisateur ou destinataire invalide." });
      return;
    }
    
    setIsSubmitting(true);
    let result;

    const transactionData = {
        ...paymentData,
        amount: finalAmount,
        paymentCurrency: paymentCurrency, // Devise de débit choisie
        pin: values.pin,
    };

    if (paymentData.type === 'POS_SALE') {
        result = await processQrSale(user.id, transactionData);
    } else {
        const pinVerification = await verifyCurrentUserPin(values.pin);
        if (!pinVerification.success) {
            openAlert({ variant: "error", title: "PIN Incorrect", description: pinVerification.error });
            setIsSubmitting(false);
            pinForm.reset();
            return;
        }
        result = await createTransaction({
            user: user,
            typeCode: 'PAYMENT',
            amount: finalAmount,
            currency: paymentData.currency,
            sourceCurrency: paymentCurrency, // Débit dans la devise choisie
            description: `Paiement à ${recipientInfo.userName}`,
            receiver_id: recipientInfo.userId,
            metadata: { qr_payment: true }
        });
    }

    setIsSubmitting(false);
    setIsPinDialogOpen(false);
    pinForm.reset();

    if (result.success) {
        onSuccess();
    } else {
      openAlert({
        variant: "error",
        title: t('payFailedTitle'),
        description: result.error,
      });
    }
  }
  
  const recipientCountryDetails = recipientInfo?.countryCode ? getCountryByCode(recipientInfo.countryCode) : null;
  const paymentWalletBalance = parseBalance(userCurrencies.find(c => c.code === paymentCurrency)?.balance);
  
  const debitSymbol = userCurrencies.find(c => c.code === paymentCurrency)?.symbol || '$';
  const originalSymbol = userCurrencies.find(c => c.code === paymentData.currency)?.symbol || '$';
  
  const hasSufficientBalance = paymentWalletBalance >= (debitedAmount + fee);

  return (
    <>
    <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck/> {t('pinConfirmTitle')}</DialogTitle>
          <DialogDescription>
            {t('pinConfirmDescription', { total: (debitedAmount + fee).toLocaleString(undefined, {minimumFractionDigits: 2}), currency: debitSymbol })}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm space-y-1 my-2 p-3 bg-muted/50 rounded-lg">
          <div className="flex justify-between"><span>{t('paymentToLabel')}</span><span className="font-semibold">{paymentData.sellerName || recipientInfo?.userName}</span></div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2 text-primary"><span>{t('totalDebitLabel')}</span><span>{debitSymbol}{(debitedAmount + fee).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        </div>
        <Form {...pinForm}>
          <form onSubmit={pinForm.handleSubmit(handlePinConfirm)} className="space-y-6 pt-4">
            <FormField control={pinForm.control} name="pin" render={({ field }) => ( <FormItem><FormLabel>{t('securityPinLabel')}</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage /></FormItem> )}/>
            <DialogFooter>
              <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}> {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t('confirmPaymentButton')} </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <Card>
      <CardHeader>
        {isLoading ? <Skeleton className="h-6 w-3/4" /> : <CardTitle>{t('payConfirmTitle', { recipient: paymentData.sellerName || recipientInfo?.userName || paymentData.recipient })}</CardTitle>}
        {isLoading ? <Skeleton className="h-4 w-1/2 mt-1" /> : (
            <div className="flex items-center gap-2 text-muted-foreground">
                <p className="text-sm">{recipientInfo?.walletId}</p>
                {recipientCountryDetails && <Image src={`https://flagcdn.com/w20/${recipientCountryDetails.code.toLowerCase()}.png`} width={16} height={12} alt={recipientCountryDetails.name}/>}
            </div>
        )}
      </CardHeader>
      <CardContent>
        {paymentData.items && paymentData.items.length > 0 && (
            <div className="mb-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><ShoppingCart className="h-4 w-4"/> {t('itemsLabel')}</h4>
                <div className="space-y-2 border rounded-md p-2 max-h-40 overflow-y-auto">
                    {paymentData.items.map(item => {
                        const itemPrice = Number(item.sellingPrice || (item as any).price || 0);
                        const itemTotal = itemPrice * Number(item.quantity || 0);
                        return (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                                <span className="flex-1 truncate pr-2">{item.name} (x{item.quantity})</span>
                                <span className="font-mono">{originalSymbol}{itemTotal.toFixed(2)}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">{t('payAmountToPay')}</p>
            <p className="text-3xl font-bold text-foreground">{originalSymbol}{(finalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
        <Form {...detailsForm}>
          <form onSubmit={detailsForm.handleSubmit(handleOpenPinDialog)} className="space-y-4">
              <FormField
                  control={detailsForm.control}
                  name="paymentCurrency"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>{t('payWithWallet')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder={t('paySelectWalletPlaceholder')} /></SelectTrigger></FormControl>
                              <SelectContent>
                                  {positiveBalanceCurrencies.map(c => (
                                      <SelectItem key={c.code} value={c.code}>{c.name} ({c.symbol}{c.balance})</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </FormItem>
                  )}
              />
              
              <div className="text-sm text-center text-muted-foreground">
                  <p>{t('payDebitedAmount')}: ~{debitSymbol}{(debitedAmount + fee).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  <p className="text-[10px] uppercase font-bold text-primary mt-1 flex items-center justify-center gap-1">
                    <ShieldCheck className="h-3 w-3"/> Frais de sécurité inclus
                  </p>
              </div>
            
            {!hasSufficientBalance && (
                 <Alert variant="destructive">
                    <Info className="h-4 w-4" />
                    <AlertTitle>{t('insufficientBalanceTitle')}</AlertTitle>
                    <AlertDescription>
                        Vous n'avez pas assez de fonds pour effectuer ce paiement.
                    </AlertDescription>
                </Alert>
            )}
            
            <Button type="submit" variant="gradient" className="w-full" disabled={isLoading || isSubmitting || !hasSufficientBalance}>
              {isLoading || isSubmitting ? <Loader2 className="animate-spin" /> : t('payConfirmButton')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </>
  );
}
