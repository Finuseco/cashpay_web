

"use client";

import { TvSubscriptionForm } from "@/components/tv-subscription/tv-subscription-form";
import type { User } from "@/lib/types";
import { createSubscription } from "@/lib/actions/subscription.actions";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";

const bouquets: { [key: string]: { id: string; name: string; price: number }[] } = {
  starlink: [
    { id: "residential", name: "Residential", price: 45 },
    { id: "roam", name: "Roam", price: 60 },
  ],
};

export function StarlinkPaymentClient({ user }: { user: User | null }) {
  const { openAlert } = useAlertDialog();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubscription(values: any) {
    if (!user) {
        openAlert({ variant: "error", title: "Error", description: "You must be logged in to perform this action." });
        return;
    }
    setIsSubmitting(true);

    const providerBouquets = bouquets[values.provider];
    const selectedBouquet = providerBouquets?.find(b => b.id === values.bouquet);

    if (!selectedBouquet) {
      openAlert({ variant: "error", title: "Error", description: "Invalid bouquet selected." });
      setIsSubmitting(false);
      return;
    }

    const result = await createSubscription({
        user,
        serviceName: selectedBouquet.name,
        amount: selectedBouquet.price,
        operatorName: values.provider,
        smartcardNumber: values.smartcardNumber
    });

    if (result.success) {
        openAlert({
            variant: "success",
            title: "Paiement Réussi",
            description: `Votre paiement de ${selectedBouquet.price} USD pour l'abonnement Starlink "${selectedBouquet.name}" a été traité.`,
        });
    } else {
        openAlert({
            variant: "error",
            title: "Error",
            description: result.error || "An unknown error occurred.",
        });
    }
    setIsSubmitting(false);
  }

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">Abonnement Starlink</h1>
            <p className="text-muted-foreground mt-2">Payez votre abonnement internet Starlink.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Formulaire de Paiement</CardTitle>
            <CardDescription>Gérez votre abonnement internet Starlink.</CardDescription>
          </CardHeader>
          <CardContent>
            <TvSubscriptionForm 
                onSubmit={handleSubscription} 
                isSubmitting={isSubmitting} 
                providerFilter="starlink" 
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
