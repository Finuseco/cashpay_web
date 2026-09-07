
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
import { Loader2, UserCheck, ShieldCheck, ArrowDown, Info, ShoppingCart, ChevronRight, Wallet } from "lucide-react";
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

// Helper robuste pour parser les balances
const parseBalance = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const cleanVal = val.replace(/,/g, '');
    const num = parseFloat(cleanVal);
    return isNaN(num) ? 0 : num;
};

const detailsSchema = z.object({
  paymentCurrency: z.string({ required_error: 'Veuillez sélectionner un portefeuille.'}),
});

const pinSchema = z.object({
  pin: z.string().length(4, "PIN requis."),
});

interface PaymentConfirmationFormProps {
  user: User;
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
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [fee, setFee] = useState(0);
  const [debitedAmount, setDebitedAmount] = useState(0);

  useEffect(() => {
      setMounted(true);
  }, []);

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
  
  const finalAmount = useMemo(() => {
    let amount = Number(paymentData.amount) || 0;
    if (paymentData.type === 'POS_SALE' && Array.isArray(paymentData.items) && paymentData.items.length > 0) {
      amount = paymentData.items.reduce((sum, item) => {
          const itemPrice = Number(item.sellingPrice || (item as any).price || 0);
          return sum + (itemPrice * Number(item.quantity || 0));
      }, 0);
    }
    return isNaN(amount) ? 0 : amount;
  }, [paymentData]);

  // Chargement des données de référence
  useEffect(() => {
    if (!mounted) return;
    const fetchInitialData = async () => {
        if (!recipientWalletId) {
            onSuccess();
            return;
        }
        setIsLoading(true);
        try {
            const [info, rates] = await Promise.all([
                getWalletInfo(recipientWalletId),
                getExchangeRatesForCountry(countryToCode(user.country))
            ]);

            if (info.success) {
                setRecipientInfo(info);
                setExchangeRates(rates);
            } else {
                openAlert({ title: "Destinataire invalide", description: info.error || "Le portefeuille de destination est introuvable.", variant: 'error'});
                onSuccess();
            }
        } catch (e) {
            console.error("Initial data fetch failed", e);
        } finally {
            setIsLoading(false);
        }
    };
    fetchInitialData();
  }, [mounted, recipientWalletId, user, openAlert, onSuccess]);
  
  // Calcul automatique des montants et frais
  const calculateAmounts = useCallback(async () => {
    if (!user?.country || !mounted) return;

    const transactionType = paymentData.type === 'POS_SALE' ? 'POS_SALE' : 'PAYMENT';
    let finalDebitedAmount = Number(finalAmount);
    let conversionRate = 1;

    if (paymentCurrency !== paymentData.currency) {
        const rateObj = exchangeRates.find(r => r.from_currency === paymentData.currency && r.to_currency === paymentCurrency);
        if (rateObj) {
            conversionRate = rateObj.rate;
            finalDebitedAmount = finalAmount * conversionRate;
        }
    }

    try {
        const calculatedFee = await calculateTransactionFee(finalDebitedAmount, paymentCurrency, transactionType, user.country);
        setDebitedAmount(finalDebitedAmount);
        setFee(calculatedFee);
    } catch (e) {
        console.error("Fee calculation failed", e);
    }
  }, [mounted, finalAmount, paymentData.currency, paymentCurrency, exchangeRates, user, paymentData.type]);

  useEffect(() => {
    calculateAmounts();
  }, [calculateAmounts]);

  const handlePinConfirm = async (values: z.infer<typeof pinSchema>) => {
    if (!user || !recipientInfo?.success) return;
    
    setIsSubmitting(true);
    let result;

    const transactionData = {
        ...paymentData,
        amount: finalAmount,
        paymentCurrency: paymentCurrency,
        pin: values.pin,
    };

    try {
        if (paymentData.type === 'POS_SALE') {
            result = await processQrSale(user.id, transactionData);
        } else {
            const pinVerification = await verifyCurrentUserPin(values.pin);
            if (!pinVerification.success) {
                throw new Error(pinVerification.error || "Code PIN incorrect.");
            }
            result = await createTransaction({
                user: user,
                typeCode: 'PAYMENT',
                amount: finalAmount,
                currency: paymentData.currency,
                sourceCurrency: paymentCurrency,
                description: `Paiement à ${recipientInfo.userName}`,
                receiver_id: recipientInfo.userId,
                metadata: { qr_payment: true }
            });
        }

        if (result.success) {
            openAlert({
                title: "Paiement réussi",
                description: `Le paiement de ${finalAmount} ${paymentData.currency} a été effectué avec succès.`,
                variant: 'success',
                onClose: () => {
                    setIsPinDialogOpen(false);
                    onSuccess();
                    router.push('/transactions');
                }
            });
        } else {
            throw new Error(result.error || "La transaction a échoué.");
        }
    } catch (e: any) {
        openAlert({ title: "Échec du paiement", description: e.message, variant: 'error' });
        pinForm.reset();
    } finally {
        setIsSubmitting(false);
    }
  };

  const recipientCountryDetails = recipientInfo?.countryCode ? getCountryByCode(recipientInfo.countryCode) : null;
  const paymentWallet = userCurrencies.find(c => c.code === paymentCurrency);
  const paymentWalletBalance = parseBalance(paymentWallet?.balance);
  const totalWithFee = debitedAmount + fee;
  const hasSufficientBalance = paymentWalletBalance >= totalWithFee;

  if (!mounted) return null;

  return (
    <>
    <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent className="max-w-xs p-6 bg-zinc-900 border-zinc-800 text-white rounded-[2rem]">
            <DialogHeader className="text-center">
                <div className="h-12 w-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2"><ShieldCheck className="text-primary"/></div>
                <DialogTitle>Validation PIN</DialogTitle>
                <DialogDescription className="text-zinc-400 text-xs">Confirmation du débit de {totalWithFee.toFixed(2)} {paymentCurrency}.</DialogDescription>
            </DialogHeader>
             <Form {...pinForm}>
                <form onSubmit={pinForm.handleSubmit(handlePinConfirm)} className="space-y-6 pt-4 text-center">
                    <FormField control={pinForm.control} name="pin" render={({ field }) => (
                        <FormControl>
                            <div className="flex justify-center">
                                <InputOTP maxLength={4} {...field}>
                                    <InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup>
                                </InputOTP>
                            </div>
                        </FormControl>
                    )} />
                    <Button type="submit" variant="gradient" className="w-full h-12 font-black" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "CONFIRMER LE PAIEMENT"}
                    </Button>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="text-center bg-primary/5 pb-4 border-b border-primary/10">
        <div className="h-12 w-12 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-3">
            <ShoppingCart className="h-6 w-6 text-primary" />
        </div>
        {isLoading ? <div className="space-y-2"><Skeleton className="h-6 w-32 mx-auto"/><Skeleton className="h-4 w-48 mx-auto"/></div> : (
            <>
                <CardTitle className="text-xl font-bold">{paymentData.sellerName || recipientInfo?.userName || "Destinataire"}</CardTitle>
                <div className="flex items-center justify-center gap-2 mt-1">
                    <p className="text-xs font-mono text-primary font-bold">{recipientWalletId}</p>
                    {recipientCountryDetails && <Image src={`https://flagcdn.com/w20/${recipientCountryDetails.code.toLowerCase()}.png`} width={16} height={12} alt="" className="rounded-sm" />}
                </div>
            </>
        )}
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {Array.isArray(paymentData.items) && paymentData.items.length > 0 && (
            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 pl-1">Récapitulatif Articles</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {paymentData.items.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-xs p-2 bg-zinc-50 rounded-lg">
                            <span className="font-bold flex-1 truncate">{item.name} <span className="text-zinc-400 font-normal">x{item.quantity}</span></span>
                            <span className="font-black">${(currentPrice(item, item.quantity) * item.quantity).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="p-6 bg-primary/5 rounded-[2rem] text-center border-2 border-dashed border-primary/10 shadow-inner">
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Montant Total</p>
            <p className="text-4xl font-black text-primary mt-1">{paymentData.currency === 'EUR' ? '€' : '$'}{finalAmount.toFixed(2)}</p>
        </div>

        <Form {...detailsForm}>
          <form onSubmit={detailsForm.handleSubmit(() => setIsPinDialogOpen(true))} className="space-y-6">
              <FormField
                  control={detailsForm.control}
                  name="paymentCurrency"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 pl-1">Payer avec le portefeuille</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="h-12 rounded-xl bg-zinc-50"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                  {userCurrencies.map(c => (
                                      <SelectItem key={c.code} value={c.code}>
                                          <div className="flex items-center gap-2">
                                              <span className="font-bold">{c.code}</span>
                                              <span className="text-zinc-400">({c.symbol}{c.balance})</span>
                                          </div>
                                      </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </FormItem>
                  )}
              />
              
              <div className="p-4 bg-zinc-50 rounded-2xl space-y-2 text-xs border border-zinc-100">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Estimation débit</span>
                    <span className="font-bold">{debitedAmount.toFixed(2)} {paymentCurrency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Frais réseau</span>
                    <span className="font-bold text-orange-600">+{fee.toFixed(2)} {paymentCurrency}</span>
                  </div>
                  <Separator className="bg-zinc-200" />
                  <div className="flex justify-between items-center font-black text-primary text-sm pt-1">
                      <span className="uppercase tracking-widest">Total Net</span>
                      <span>{totalWithFee.toFixed(2)} {paymentCurrency}</span>
                  </div>
              </div>
            
            {!hasSufficientBalance && !isLoading && (
                 <Alert variant="destructive" className="rounded-xl bg-red-50 border-red-100">
                    <AlertTitle className="text-xs font-black uppercase">Solde insuffisant</AlertTitle>
                    <AlertDescription className="text-[10px]">
                        Veuillez recharger votre portefeuille {paymentCurrency} pour valider cet achat.
                    </AlertDescription>
                </Alert>
            )}
            
            <div className="flex flex-col gap-3">
                <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl rounded-2xl" disabled={isLoading || isSubmitting || !hasSufficientBalance}>
                    PAYER MAINTENANT
                </Button>
                <Button type="button" variant="ghost" onClick={onSuccess} className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Annuler la transaction</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
    </>
  );
}
