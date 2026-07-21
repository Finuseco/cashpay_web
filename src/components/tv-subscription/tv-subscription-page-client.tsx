

'use client';

import { useState } from "react";
import { TvSubscriptionForm, type TvSubscriptionFormValues } from "@/components/tv-subscription/tv-subscription-form";
import type { User } from "@/lib/types";
import { createSubscription } from "@/lib/actions/subscription.actions";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { verifyCurrentUserPin } from "@/lib/actions/auth.actions";

const bouquets: { [key: string]: { id: string; name: string; price: number }[] } = {
  canal_plus: [ { id: "evasion", name: "Evasion+", price: 20 }, { id: "tout_canal", name: "Tout Canal+", price: 50 }, { id: "access", name: "Access", price: 10 } ],
  startimes: [ { id: "smart", name: "Smart Bouquet", price: 15 }, { id: "super", name: "Super Bouquet", price: 25 }, { id: "basic", name: "Basic Bouquet", price: 8 } ],
  easytv: [ { id: "basic", name: "Basic Plan", price: 12 }, { id: "premium", name: "Premium Plan", price: 22 } ],
  starlink: [ { id: "residential", name: "Residential", price: 45 }, { id: "roam", name: "Roam", price: 60 } ],
  bluesat: [ { id: "discovery", name: "Discovery", price: 18 }, { id: "galaxy", name: "Galaxy", price: 35 } ],
};

const pinSchema = z.object({
  pin: z.string().min(4, { message: 'Le code PIN doit comporter 4 chiffres.' }),
});


export function TvSubscriptionPage({ user, providerFilter }: { user: User | null, providerFilter?: 'starlink' }) {
  const { openAlert } = useAlertDialog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<TvSubscriptionFormValues | null>(null);

  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });

  const handleFormSubmit = async (values: TvSubscriptionFormValues) => {
    setSubscriptionDetails(values);
    setIsPinDialogOpen(true);
  };
  
  const handlePinConfirm = async (pinValues: z.infer<typeof pinSchema>) => {
    if (!user || !subscriptionDetails) {
        openAlert({ variant: "error", title: "Erreur", description: "Données utilisateur ou d'abonnement manquantes." });
        return;
    }
    
    setIsSubmitting(true);
    
    const pinVerification = await verifyCurrentUserPin(pinValues.pin);
    if (!pinVerification.success) {
      openAlert({ variant: "error", title: "PIN Incorrect", description: pinVerification.error });
      setIsSubmitting(false);
      pinForm.reset();
      return;
    }

    const providerBouquets = bouquets[subscriptionDetails.provider];
    const selectedBouquet = providerBouquets?.find(b => b.id === subscriptionDetails.bouquet);

    if (!selectedBouquet) {
      openAlert({ variant: "error", title: "Erreur", description: "Bouquet invalide sélectionné." });
      setIsSubmitting(false);
      return;
    }

    const result = await createSubscription({
        user,
        serviceName: selectedBouquet.name,
        amount: selectedBouquet.price,
        operatorName: subscriptionDetails.provider,
        smartcardNumber: subscriptionDetails.smartcardNumber
    });

    if (result.success) {
        openAlert({
            variant: "success",
            title: 'Abonnement réussi',
            description: `Votre paiement de ${selectedBouquet.price}$ pour le forfait ${selectedBouquet.name} sur la carte ${subscriptionDetails.smartcardNumber} a été effectué.`,
        });
        setIsPinDialogOpen(false);
        // Reset the main form via a ref or other method if needed.
    } else {
        openAlert({
            variant: "error",
            title: "Erreur",
            description: result.error || "Une erreur inconnue est survenue.",
        });
    }
    setIsSubmitting(false);
    pinForm.reset();
  };

  const smartcardLabel = providerFilter === 'starlink' ? "Numéro du Kit Starlink" : "Numéro de carte à puce / décodeur";
  const smartcardPlaceholder = providerFilter === 'starlink' ? "Entrez votre numéro de kit" : "Entrez le numéro de la carte à puce";

  return (
    <>
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ShieldCheck /> Confirmer le Paiement</DialogTitle>
                <DialogDescription>
                    Entrez votre code PIN à 4 chiffres pour confirmer le paiement de l'abonnement.
                </DialogDescription>
            </DialogHeader>
            <Form {...pinForm}>
                <form onSubmit={pinForm.handleSubmit(handlePinConfirm)} className="space-y-6 pt-4">
                    <FormField control={pinForm.control} name="pin" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Code PIN de Transaction</FormLabel>
                        <FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}/>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsPinDialogOpen(false)}>Annuler</Button>
                      <Button type="submit" variant="gradient" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmer
                      </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Formulaire de Réabonnement</CardTitle>
              <CardDescription>Gérez votre abonnement TV.</CardDescription>
            </CardHeader>
            <CardContent>
              <TvSubscriptionForm 
                  onSubmit={handleFormSubmit} 
                  isSubmitting={false}
                  providerFilter={providerFilter} 
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
