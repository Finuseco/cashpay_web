
'use client';

import { useState, useCallback, useEffect } from "react";
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
import { Loader2, QrCode, UserCheck, Search } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QrScannerDialog } from "../shared/qr-scanner-dialog";
import { agentDeposit } from "@/lib/actions/agent.actions";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getWalletInfo } from "@/lib/actions/wallet.actions";
import type { WalletInfo } from "@/lib/actions/wallet.actions";
import Image from "next/image";
import type { User, Currency } from '@/lib/types';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { getUserCurrencies } from "@/lib/actions/currency.actions";


const depositSchema = z.object({
  walletId: z.string().regex(/^[A-Z]{2}\d{10}$/, { message: "Format d'ID de portefeuille invalide." }),
  amount: z.coerce.number().positive({ message: "Le montant doit être positif." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  agentPin: z.string().length(4, { message: "Le PIN doit contenir 4 chiffres." }),
});

export function AgentDepositClient() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { openAlert } = useAlertDialog();
  const [verificationResult, setVerificationResult] = useState<WalletInfo | null>(null);
  const [agent, setAgent] = useState<User | null>(null);
  const [agentCurrencies, setAgentCurrencies] = useState<Currency[]>([]);

  useEffect(() => {
    const fetchAgentData = async () => {
        const agentData = await getAuthenticatedUser();
        setAgent(agentData);
        if (agentData) {
            const currencies = await getUserCurrencies(agentData.id);
            setAgentCurrencies(currencies);
        }
    };
    fetchAgentData();
  }, []);

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      walletId: "",
      amount: undefined,
      currency: "USD",
      agentPin: "",
    },
  });
  
  const handleVerify = async () => {
    const walletId = form.getValues('walletId');
    if (!walletId || !agent) return;
    
    if(walletId === agent.id_wallet) {
        form.setError("walletId", { type: "manual", message: "Vous ne pouvez pas effectuer un dépôt sur votre propre compte." });
        setVerificationResult(null);
        return;
    }
    
    setIsVerifying(true);
    const result = await getWalletInfo(walletId);
    setVerificationResult(result);
    if(result.error) {
        form.setError("walletId", { type: "manual", message: result.error });
    } else {
        form.clearErrors("walletId");
    }
    setIsVerifying(false);
  };

  const handleScanSuccess = useCallback(async (scannedId: string) => {
    setIsScannerOpen(false);
    form.setValue('walletId', scannedId, { shouldValidate: true });
    
    await new Promise(res => setTimeout(res, 50)); 

    const agentWalletId = agent?.id_wallet;
    if (scannedId === agentWalletId) {
        form.setError("walletId", { type: "manual", message: "Vous ne pouvez pas effectuer un dépôt sur votre propre compte." });
        setVerificationResult(null);
        return;
    }

    setIsVerifying(true);
    const result = await getWalletInfo(scannedId);
    setVerificationResult(result);
    if(result.error) {
        form.setError("walletId", { type: "manual", message: result.error });
    } else {
        form.clearErrors("walletId");
    }
    setIsVerifying(false);
  }, [form, agent]);

  async function onSubmit(values: z.infer<typeof depositSchema>) {
    setIsSubmitting(true);
    
    if (!agent) {
        openAlert({ variant: 'error', title: 'Erreur', description: 'Agent non authentifié.'});
        setIsSubmitting(false);
        return;
    }

    const result = await agentDeposit({
      agent,
      clientWalletId: values.walletId,
      amount: values.amount,
      currency: values.currency,
      agentPin: values.agentPin,
    });
    
    setIsSubmitting(false);

    if (result.success) {
      openAlert({
        variant: 'success',
        title: "Dépôt Réussi",
        description: (
          <div>
            <p>Le dépôt de <span className="font-bold">{values.amount} {values.currency}</span> sur le portefeuille <span className="font-mono">{values.walletId}</span> a été effectué.</p>
             {result.agentNewBalance !== undefined && (
              <p className="mt-1 text-xs text-muted-foreground">Votre nouveau solde agent : {result.agentNewBalance.toFixed(2)} {values.currency}</p>
            )}
          </div>
        ),
        onClose: () => {
             form.reset({ walletId: "", amount: undefined, currency: "USD", agentPin: "" });
             setVerificationResult(null);
        }
      });
    } else {
       openAlert({
        variant: 'error',
        title: "Échec du Dépôt",
        description: result.error,
      });
    }
  }

  return (
    <>
      <QrScannerDialog 
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScanSuccess={handleScanSuccess}
      />
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Effectuer un Dépôt Client</CardTitle>
          <CardDescription>Saisissez le portefeuille du client et le montant à déposer.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="walletId"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>ID Portefeuille du Client</FormLabel>
                        <div className="flex items-center gap-2">
                           <FormControl>
                                <Input 
                                    placeholder="Ex: CD1234567890" 
                                    {...field} 
                                    onChange={(e) => {
                                        field.onChange(e);
                                        setVerificationResult(null);
                                    }}
                                />
                           </FormControl>
                           <Button type="button" variant="outline" size="icon" onClick={handleVerify} disabled={isVerifying || !field.value}><Search className="h-4 w-4" /></Button>
                           <Button type="button" variant="outline" size="icon" onClick={() => setIsScannerOpen(true)}><QrCode className="h-5 w-5" /></Button>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
              />

               {isVerifying && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Vérification en cours...</div>}
               {verificationResult?.success && (
                    <div className="p-2 bg-green-50 text-green-800 rounded-md flex items-center gap-3 text-sm font-semibold">
                        <UserCheck className="h-4 w-4"/> Titulaire : {verificationResult.userName}
                    </div>
               )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Montant à Déposer</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} value={field.value || ''} />
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
                       <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-2">
                            {agentCurrencies.map(c => (
                                <div key={c.code}>
                                    <RadioGroupItem value={c.code} id={`dep-cur-${c.code}`} className="sr-only" />
                                    <Label htmlFor={`dep-cur-${c.code}`} className={`flex items-center justify-center h-10 px-4 border-2 rounded-lg cursor-pointer font-bold text-sm transition-all ${field.value === c.code ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-200 text-zinc-400'}`}>{c.code}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="agentPin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIN de l'Agent</FormLabel>
                    <FormControl>
                      <div className="flex justify-center">
                        <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting || !verificationResult?.success}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Effectuer le Dépôt
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
