
'use client';

import { useState, useEffect } from "react";
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
import { Loader2, ArrowLeft, ShieldCheck, UserCheck } from "lucide-react";
import { InternationalWalletInput } from "../shared/international-wallet-input";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { initiateClientTransfer, confirmClientTransfer } from "@/lib/actions/agent.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import type { User, Currency } from '@/lib/types';
import type { WalletInfo } from "@/lib/actions/wallet.actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { sendAndStoreOtp } from "@/lib/actions/auth.actions";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";


const transferSchema = z.object({
  senderWalletId: z.string().min(12, { message: "L'ID du portefeuille doit contenir au moins 12 caractères." }).max(12),
  recipientWalletId: z.string().min(12, { message: "L'ID du portefeuille doit contenir au moins 12 caractères." }).max(12),
  amount: z.coerce.number().positive({ message: "Le montant doit être positif." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
}).refine(data => data.senderWalletId !== data.recipientWalletId, {
  message: "Le portefeuille de l'expéditeur et du destinataire ne peuvent pas être identiques.",
  path: ["recipientWalletId"],
});

const otpSchema = z.object({
  otp: z.string().min(6, { message: 'Le code OTP doit comporter 6 chiffres.' }),
});

export function AgentTransferClient({ agent }: { agent: User | null }) {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { openAlert } = useAlertDialog();
  
  const [senderVerification, setSenderVerification] = useState<WalletInfo | null>(null);
  const [recipientVerification, setRecipientVerification] = useState<WalletInfo | null>(null);
  const [agentCurrencies, setAgentCurrencies] = useState<Currency[]>([]);

  const form = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { amount: undefined, senderWalletId: "", recipientWalletId: "", currency: "USD" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });
  
  useEffect(() => {
    const fetchAgentCurrencies = async () => {
        if(agent) {
            const currencies = await getUserCurrencies(agent.id);
            setAgentCurrencies(currencies);
        }
    };
    fetchAgentCurrencies();
  }, [agent]);


  const resetFlow = () => {
    form.reset({ senderWalletId: "", recipientWalletId: "", amount: undefined, currency: "USD" });
    otpForm.reset();
    setStep('details');
    setSenderVerification(null);
    setRecipientVerification(null);
  };
  
  const handleSenderVerification = (result: WalletInfo | null) => {
    if (result?.walletId === agent?.id_wallet) {
        form.setError("senderWalletId", { type: "manual", message: "Un agent ne peut être l'expéditeur." });
        setSenderVerification(null);
        return;
    }
    setSenderVerification(result);
    if (result && result.error) {
      form.setError("senderWalletId", { type: "manual", message: result.error });
    } else if (result?.success) {
      form.clearErrors("senderWalletId");
    }
  };
  const handleRecipientVerification = (result: WalletInfo | null) => {
     if (result?.walletId === agent?.id_wallet) {
        form.setError("recipientWalletId", { type: "manual", message: "Un agent ne peut être le destinataire." });
        setRecipientVerification(null);
        return;
    }
    setRecipientVerification(result);
    if (result && result.error) {
      form.setError("recipientWalletId", { type: "manual", message: result.error });
    } else if (result?.success) {
      form.clearErrors("recipientWalletId");
    }
  };

  const handleDetailsSubmit = async (values: z.infer<typeof transferSchema>) => {
    if (!senderVerification?.userName || !recipientVerification?.userName) {
        openAlert({ variant: 'error', title: 'Vérification Requise', description: 'Veuillez vérifier les deux portefeuilles avant de continuer.' });
        return;
    }

    setIsSubmitting(true);
    const result = await initiateClientTransfer({ 
        senderWalletId: values.senderWalletId, 
        amount: values.amount, 
        currency: values.currency,
        agentName: agent?.first_name || 'Agent',
    });
    
    if(result.success) {
        openAlert({ variant: 'info', title: 'Code envoyé', description: result.message });
        setStep('otp');
    } else {
        if (result.backupOtp) {
            openAlert({
                variant: 'warning',
                title: 'Erreur d\'envoi SMS',
                description: (
                    <div>
                        <p className="mb-2">L'envoi par SMS a échoué. Utilisez ce code de secours pour valider la transaction :</p>
                        <p className="text-2xl font-bold tracking-widest bg-muted p-2 rounded-md">{result.backupOtp}</p>
                        <p className="text-xs text-muted-foreground mt-2">Ce code n'a été montré qu'à vous. Assurez-vous que le client est bien la personne qui a initié la demande.</p>
                    </div>
                )
            });
             setStep('otp'); // Still proceed to OTP step
        } else {
            openAlert({ variant: "error", title: "Erreur", description: result.error });
        }
    }
    setIsSubmitting(false);
  };
  
  const handleOtpSubmit = async (values: z.infer<typeof otpSchema>) => {
      setIsSubmitting(true);
      const details = form.getValues();
      const result = await confirmClientTransfer({
        ...details,
        currency: details.currency,
        code: values.otp,
        method: 'otp', // OTP is the only method in this flow
      });
      if (result.success) {
        openAlert({
            variant: "success",
            title: "Transfert Réussi",
            description: `Le transfert de ${details.amount} ${details.currency} de ${senderVerification?.userName} vers ${recipientVerification?.userName} a été effectué.`,
            onClose: resetFlow,
        });
      } else {
          openAlert({ variant: 'error', title: 'Échec', description: result.error });
          otpForm.reset();
      }
      setIsSubmitting(false);
  }

  const handleResendOtp = async (channel: 'sms' | 'in-app') => {
      if (!senderVerification?.userId) return;
      setIsResending(true);
      
      const result = await sendAndStoreOtp(senderVerification.userId, `un transfert de ${form.getValues('amount')} ${form.getValues('currency')}`, channel);
      
      if (result.success) {
          openAlert({ variant: 'info', title: 'Code Renvoyé', description: `Un nouveau code a été envoyé au client via ${channel === 'sms' ? 'l\'application' : 'SMS'}.` });
      } else {
          openAlert({ variant: 'error', title: 'Échec', description: result.error });
      }
      
      setIsResending(false);
  };


  if (!agent) {
    return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <>
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Transfert entre Clients</CardTitle>
          <CardDescription>Facilité par un agent.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="senderWalletId"
                render={({ field }) => (
                   <FormItem>
                     <InternationalWalletInput
                        field={field}
                        onVerificationResult={handleSenderVerification}
                        label="ID du Portefeuille de l'Expéditeur"
                        placeholder="Ex: CD1234567890"
                      />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recipientWalletId"
                render={({ field }) => (
                   <FormItem>
                     <InternationalWalletInput
                        field={field}
                        onVerificationResult={handleRecipientVerification}
                        label="ID du Portefeuille du Destinataire"
                        placeholder="Ex: FR0987654321"
                      />
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Montant à Transférer</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0.00" {...field} value={field.value || ''}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Devise</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                               {agentCurrencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
               </div>
              <Button type="submit" className="w-full" disabled={isSubmitting || !senderVerification?.success || !recipientVerification?.success}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Demander la vérification au client
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Dialog open={step === 'otp'} onOpenChange={(isOpen) => !isOpen && setStep('details')}>
          <DialogContent>
                <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ShieldCheck /> Confirmation par OTP Client</DialogTitle>
                <DialogDescription>
                    L'expéditeur (<b>{senderVerification?.userName}</b>) doit vous fournir le code OTP à 6 chiffres pour confirmer le transfert de <b>{form.getValues('amount')} {form.getValues('currency')}</b>.
                </DialogDescription>
                </DialogHeader>
                <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(handleOtpSubmit)} className="space-y-6 pt-4">
                    <FormField control={otpForm.control} name="otp" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Code OTP de l'Expéditeur</FormLabel>
                        <FormControl><div className="flex justify-center"><InputOTP maxLength={6} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup></InputOTP></div></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}/>
                    <div className="flex flex-col-reverse sm:flex-row gap-4">
                        <Button type="button" variant="outline" className="w-full" onClick={() => setStep('details')}><ArrowLeft className="mr-2 h-4 w-4" />Retour</Button>
                        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmer le Transfert
                        </Button>
                    </div>
                </form>
                </Form>
                 <DialogFooter className="pt-4 border-t">
                    <div className="w-full text-center">
                        <p className="text-sm text-muted-foreground">Le client n'a pas reçu le code ?</p>
                        <div className="flex gap-4 mt-2">
                            <Button variant="link" onClick={() => handleResendOtp('sms')} disabled={isResending} className="flex-1 h-auto">Renvoyer par SMS</Button>
                            <Button variant="link" onClick={() => handleResendOtp('in-app')} disabled={isResending} className="flex-1 h-auto">Renvoyer via l'App</Button>
                        </div>
                    </div>
                </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
