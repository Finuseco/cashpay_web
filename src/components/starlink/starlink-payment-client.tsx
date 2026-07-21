

"use client";

import { TvSubscriptionForm } from "@/components/tv-subscription/tv-subscription-form";
import type { User } from "@/lib/types";
import { createSubscription } from "@/lib/actions/subscription.actions";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const bouquets: { [key: string]: { id: string; name: string; price: number }[] } = {
  starlink: [
    { id: "residential", name: "Residential", price: 45 },
    { id: "roam", name: "Roam", price: 60 },
  ],
};

export function StarlinkPaymentClient({ user, isPaymentEnabled = true }: { user: User | null, isPaymentEnabled?: boolean }) {
  const { openAlert } = useAlertDialog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  async function handleSubscription(values: any) {
    if (!isPaymentEnabled) {
      openAlert({
        title: t('comingSoon'),
        description: "Le renouvellement des abonnements Starlink sera bientôt disponible. Merci de votre patience.",
        variant: 'info'
      });
      return;
    }

    if (!user) {
        openAlert({ variant: "error", title: t('errorTitle'), description: "You must be logged in to perform this action." });
        return;
    }
    setIsSubmitting(true);

    const providerBouquets = bouquets[values.provider];
    const selectedBouquet = providerBouquets?.find(b => b.id === values.bouquet);

    if (!selectedBouquet) {
      openAlert({ variant: "error", title: t('errorTitle'), description: "Invalid bouquet selected." });
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
            title: t('errorTitle'),
            description: result.error || "An unknown error occurred.",
        });
    }
    setIsSubmitting(false);
  }

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">{t('starlinkPaymentTitle')}</h1>
            <p className="text-muted-foreground mt-2">{t('starlinkPaymentDescription')}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('paymentFormTitle')}</CardTitle>
            <CardDescription>{t('paymentFormDescription')}</CardDescription>
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
