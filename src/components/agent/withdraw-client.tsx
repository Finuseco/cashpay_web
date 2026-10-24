

'use client';

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { Loader2, ArrowLeft, ShieldCheck, UserCheck } from "lucide-react";
import { InternationalWalletInput } from "../shared/international-wallet-input";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { confirmWithdrawal } from "@/lib/actions/agent.actions";
import { sendAndStoreOtp } from "@/lib/actions/auth.actions";
import type { WalletInfo } from "@/lib/actions/wallet.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { User, Currency } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { calculateTransactionFee } from "@/lib/actions/wallet.actions";
import { Separator } from "@/components/ui/separator";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";


const detailsSchema = z.object({
  walletId: z.string().min(12, { message: "L'ID du portefeuille doit contenir au moins 12 caractères." }).max(12),
  amount: z.coerce.number().positive({ message: "Le montant doit être positif." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
});

const codeSchema = z.object({
  code: z.string().min(4, { message: 'Le code est requis.' }),
});

type WithdrawalDetails = z.infer<typeof detailsSchema>;

export function AgentWithdrawClient() {
  const [step, setStep] = useState<'details' | 'confirm'>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [transactionFee, setTransactionFee] = useState(0);
  
  const [withdrawalDetails, setWithdrawalDetails] = useState<WithdrawalDetails | null>(null);
  const [verifiedClient, setVerifiedClient] = useState<WalletInfo | null>(null);
  const [agent, setAgent] = useState<User | null>(null);
  const [agentCurrencies, setAgentCurrencies] = useState<string[]>([]);
  const [confirmationMethod, setConfirmationMethod] = useState<'otp' | 'pin'>('otp');
  
  const { openAlert } = useAlertDialog();

  const detailsForm = useForm<WithdrawalDetails>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { walletId: "", amount: undefined, currency: "USD" },
  });

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });
  

  useEffect(() => {
    const fetchAgentData = async () => {
        const fetchedAgent = await getAuthenticatedUser();
        setAgent(fetchedAgent);
        if (fetchedAgent) {
            const currencies = await getUserCurrencies(fetchedAgent.id);
            setAgentCurrencies(currencies.map(c => c.code));
        }
    }
    fetchAgentData();
  }, []);

  const amountValue = detailsForm.watch("amount");
  const currencyValue = detailsForm.watch("currency");

  useEffect(() => {
      if (verifiedClient?.countryCode && amountValue > 0 && currencyValue) {
          const fetchFee = async () => {
              const fee = await calculateTransactionFee(amountValue, currencyValue as any, 'WD', verifiedClient.countryCode!);
              setTransactionFee(fee);
          }
          fetchFee();
      } else {
          setTransactionFee(0);
      }
  }, [amountValue, currencyValue, verifiedClient]);
  
  const handleVerificationResult = (result: WalletInfo | null) => {
    if (result?.walletId === agent?.id_wallet) {
        detailsForm.setError("walletId", { type: "manual", message: "Vous ne pouvez pas effectuer un retrait pour vous-même." });
        setVerifiedClient(null);
        return;
    }
    
    setVerifiedClient(result);
    if (result && result.error) {
      detailsForm.setError("walletId", { type: "manual", message: result.error });
    } else if (result?.success) {
      detailsForm.clearErrors("walletId");
    }
  };

  const handleProceedToConfirm = async (values: WithdrawalDetails) => {
    if (!verifiedClient?.success) {
        openAlert({ variant: 'error', title: 'Client Invalide', description: 'Veuillez vérifier et valider l\'ID du portefeuille du client.' });
        return;
    }
    if (!agentCurrencies.includes(values.currency)) {
        openAlert({ variant: 'error', title: 'Devise Non Gérée', description: `Vous ne pouvez pas effectuer un retrait en ${values.currency} car vous ne gérez pas cette devise.` });
        return;
    }
    
    setWithdrawalDetails(values);
    
    if (agent && verifiedClient.userId) {
        await sendAndStoreOtp(verifiedClient.userId, `un retrait de ${values.amount} ${values.currency}`, 'sms');
        openAlert({variant: 'info', title: 'Code envoyé', description: 'Un OTP a été envoyé au client pour validation.'});
    }

    setStep('confirm');
  }
  
  const resetFlow = () => {
    detailsForm.reset({ walletId: "", amount: undefined, currency: "USD" });
    codeForm.reset();
    setStep('details');
    setVerifiedClient(null);
    setWithdrawalDetails(null);
  };

  const handleConfirmSubmit = async (values: z.infer<typeof codeSchema>) => {
    setIsLoading(true);
    if (!agent || !withdrawalDetails || !verifiedClient || !verifiedClient.userId) {
        openAlert({ variant: 'error', title: 'Erreur de session', description: 'Données de transaction manquantes.'});
        setIsLoading(false);
        return;
    }

    const result = await confirmWithdrawal({
        agent,
        clientWalletId: withdrawalDetails.walletId,
        amount: withdrawalDetails.amount,
        currency: withdrawalDetails.currency as 'USD' | 'EUR' | 'CDF',
        code: values.code,
        method: confirmationMethod,
    });

    if (result.success) {
        openAlert({
            variant: "success",
            title: "Retrait Réussi",
            description: `Le retrait de ${withdrawalDetails.amount} ${withdrawalDetails.currency} du portefeuille ${withdrawalDetails.walletId} a été effectué.`,
            onClose: resetFlow,
        });
    } else {
        openAlert({ variant: 'error', title: 'Échec', description: result.error });
        codeForm.reset();
    }
    setIsLoading(false);
  }

  const handleResendOtp = async (channel: 'sms' | 'in-app') => {
      if (!verifiedClient?.userId || !withdrawalDetails) return;
      setIsResending(true);
      const result = await sendAndStoreOtp(verifiedClient.userId, `un retrait de ${withdrawalDetails.amount} ${withdrawalDetails.currency}`, channel);
      if (result.success) {
          openAlert({ variant: 'info', title: 'Code Renvoyé', description: `Un nouveau code a été envoyé au client via ${channel === 'sms' ? 'l\'application' : 'SMS'}.` });
      } else {
          openAlert({ variant: 'error', title: 'Échec', description: result.error });
      }
      setIsResending(false);
  };


  return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Effectuer un Retrait Client</CardTitle>
          <CardDescription>Saisissez l'ID du client et le montant, puis validez avec son code.</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'details' && (
            <Form {...detailsForm}>
              <form onSubmit={detailsForm.handleSubmit(handleProceedToConfirm)} className="space-y-6">
                 <FormField
                    control={detailsForm.control}
                    name="walletId"
                    render={({ field }) => (
                        <FormItem>
                            <InternationalWalletInput
                                field={field}
                                onVerificationResult={handleVerificationResult}
                                label="ID du Portefeuille du Client"
                                placeholder="Ex: CD1234567890"
                                data-testid="wallet-id-input"
                            />
                        </FormItem>
                    )}
                />
                {verifiedClient?.success && (
                    <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                       <FormField control={detailsForm.control} name="amount" render={({ field }) => (
                           <FormItem className="sm:col-span-2"> <FormLabel>Montant à Retirer</FormLabel> <FormControl> <Input type="number" placeholder="0.00" {...field} value={field.value || ''} /> </FormControl> <FormMessage /> </FormItem>
                       )} />
                       <FormField control={detailsForm.control} name="currency" render={({ field }) => (
                           <FormItem>
                               <FormLabel>Devise</FormLabel>
                               <FormControl>
                                   <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-2">
                                       {agentCurrencies.map(code => (
                                           <div key={code}>
                                               <RadioGroupItem value={code} id={`wd-cur-${code}`} className="sr-only" />
                                               <Label htmlFor={`wd-cur-${code}`} className={`flex items-center justify-center h-10 px-4 border-2 rounded-lg cursor-pointer font-bold text-sm transition-all ${field.value === code ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-200 text-zinc-400'}`}>{code}</Label>
                                           </div>
                                       ))}
                                   </RadioGroup>
                               </FormControl>
                               <FormMessage />
                           </FormItem>
                       )} />
                    </div>
                    {transactionFee > 0 && <p className="text-sm text-muted-foreground">Frais de transaction estimés: {transactionFee.toFixed(2)} {currencyValue}</p>}
                    </>
                )}
                <Button type="submit" className="w-full" disabled={!verifiedClient?.success}>
                  Continuer
                </Button>
              </form>
            </Form>
          )}

          {step === 'confirm' && withdrawalDetails && verifiedClient && (
             <Form {...codeForm}>
                <form onSubmit={codeForm.handleSubmit(handleConfirmSubmit)} className="space-y-4">
                 <div className="mb-4 p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Client</span><div className="flex items-center gap-2 font-semibold"><UserCheck className="h-4 w-4 text-green-500" />{verifiedClient.userName}</div></div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Montant du retrait</span><span className="font-semibold">{withdrawalDetails.amount.toFixed(2)} {withdrawalDetails.currency}</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Frais de transaction</span><span className="font-semibold">{transactionFee.toFixed(2)} {withdrawalDetails.currency}</span></div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between items-center text-lg font-bold"><span>Total à décaisser</span><span>{(withdrawalDetails.amount + transactionFee).toFixed(2)} {withdrawalDetails.currency}</span></div>
                </div>
                 <Tabs defaultValue="otp" onValueChange={(value) => setConfirmationMethod(value as 'otp' | 'pin')}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="otp">OTP Client</TabsTrigger>
                        <TabsTrigger value="pin">PIN Client</TabsTrigger>
                    </TabsList>
                    <TabsContent value="otp" className="pt-4">
                        <FormField control={codeForm.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Code OTP reçu par le client</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={6} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage /></FormItem> )}/>
                        <div className="text-center mt-4">
                            <p className="text-sm text-muted-foreground">Le client n'a pas reçu le code ?</p>
                            <div className="flex gap-4 mt-2">
                                <Button variant="link" onClick={() => handleResendOtp('sms')} disabled={isResending} className="flex-1 h-auto">Renvoyer par SMS</Button>
                                <Button variant="link" onClick={() => handleResendOtp('in-app')} disabled={isResending} className="flex-1 h-auto">Renvoyer via l'App</Button>
                            </div>
                        </div>
                    </TabsContent>
                     <TabsContent value="pin" className="pt-4">
                        <FormField control={codeForm.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Code PIN secret du client</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage /></FormItem> )}/>
                    </TabsContent>
                 </Tabs>

                 <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
                    <Button type="button" variant="outline" className="w-full" onClick={() => setStep('details')}><ArrowLeft className="mr-2 h-4 w-4" />Retour</Button>
                    <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmer la transaction</Button>
                </div>
                </form>
             </Form>
          )}

        </CardContent>
      </Card>
  );
}
