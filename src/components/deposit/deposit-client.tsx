
'use client';

import { useTranslation } from "react-i18next";
import { useState } from "react";
import Image from "next/image";
import { CreditCard, Smartphone, Loader2, Bitcoin, ShieldCheck, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { initiateDeposit, initiateCardDeposit, initiatePayPalDeposit } from "@/lib/actions/deposit.actions";
import type { User, Country } from '@/lib/types';
import { MobileMoneyDepositForm } from './mobile-money-deposit-form';
import { CardDepositForm } from './card-deposit-form';
import { PayPalDepositForm } from './paypal-deposit-form';
import { CryptoTransferForm } from "../bank-transfer/crypto-transfer-form";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from 'framer-motion';
import { DepositStatusDialog } from './deposit-status-dialog';

export function DepositClient({ user, selectedCountry }: { user: User | null, selectedCountry: Country }) {
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const router = useRouter();

  const countryHasMobileMoney = ['CD', 'SN', 'CG', 'GA', 'KE', 'MG', 'MW', 'NE', 'NG', 'RW', 'SL', 'TZ', 'UG', 'ZM', 'BW', 'BF', 'CM', 'CF', 'CI', 'GN', 'GW', 'JO', 'LR', 'ML', 'MA', 'NE', 'TN', 'TD', 'AO', 'GM', 'BJ', 'ZA', 'SZ', 'SS', 'ET', 'ZW', 'MZ', 'GH', 'EG'].includes(selectedCountry.code);
  
  const defaultTab = countryHasMobileMoney ? "mobile_money" : "card";

  const handleSubmit = async (processor: (args: any) => Promise<any>, values: any) => {
    setIsSubmitting(true);
    const result = await processor({ ...values, user });

    if (result.success) {
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else if (result.reference) {
        // This is a direct API call (MaxiCash), trigger the status tunnel
        setActiveReference(result.reference);
        setIsStatusDialogOpen(true);
      } else {
        openAlert({
          variant: 'success',
          title: t('depositSuccessTitle', 'Demande Traitée'),
          description: result.message || t('depositSuccessMessage', "Votre demande de dépôt a été initiée. Veuillez vérifier votre téléphone pour la validation."),
          onClose: () => router.push('/dashboard')
        });
      }
    } else {
      openAlert({
        variant: 'error',
        title: t('depositFailedTitle', "Échec de l'opération"),
        description: result.error || t('depositFailedMessage', "Une erreur est survenue lors de l'initiation du dépôt."),
      });
    }
    setIsSubmitting(false);
  };

  const handleStatusSuccess = () => {
    setIsStatusDialogOpen(false);
    router.push('/dashboard');
  };

  return (
    <div className="relative">
      <DepositStatusDialog 
          open={isStatusDialogOpen} 
          reference={activeReference} 
          onClose={() => setIsStatusDialogOpen(false)}
          onSuccess={handleStatusSuccess}
      />

      <AnimatePresence>
        {isSubmitting && !isStatusDialogOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg"
          >
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="font-bold text-primary uppercase tracking-widest text-xs">{t('processingSecurely', 'Traitement Sécurisé...')}</p>
          </motion.div>
        )}
      </AnimatePresence>

        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-2xl font-black tracking-tight">{t('depositTitle', 'Approvisionner mon compte')}</CardTitle>
                    <CardDescription>
                        {selectedCountry.name} • {t('depositAddFundsDescription', 'Choisissez votre méthode de paiement préférée.')}
                    </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        <ShieldCheck className="h-3 w-3" /> {t('secureBadge', 'SÉCURISÉ')}
                    </div>
                </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-muted/50 p-1 h-12">
                    {countryHasMobileMoney && (
                        <TabsTrigger value="mobile_money" className="data-[state=active]:bg-background">
                            <Smartphone className="mr-2 h-4 w-4"/>{t('mobileTab', 'Mobile')}
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="card" className="data-[state=active]:bg-background">
                        <CreditCard className="mr-2 h-4 w-4"/>{t('cardTab', 'Carte')}
                    </TabsTrigger>
                    <TabsTrigger value="paypal" className="data-[state=active]:bg-background">PayPal</TabsTrigger>
                    <TabsTrigger value="crypto" className="data-[state=active]:bg-background">
                        <Bitcoin className="mr-2 h-4 w-4"/>Crypto
                    </TabsTrigger>
                </TabsList>
                
                {countryHasMobileMoney && (
                    <TabsContent value="mobile_money" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <MobileMoneyDepositForm user={user} country={selectedCountry} onSubmit={(values: any) => handleSubmit(initiateDeposit, values)} isSubmitting={isSubmitting} />
                    </TabsContent>
                )}
                
                <TabsContent value="card" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                    <CardDepositForm user={user} onSubmit={(values: any) => handleSubmit(initiateCardDeposit, values)} isSubmitting={isSubmitting}/>
                </TabsContent>
                
                <TabsContent value="paypal" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                    <PayPalDepositForm user={user} onSubmit={(values: any) => handleSubmit(initiatePayPalDeposit, values)} isSubmitting={isSubmitting} />
                </TabsContent>
                
                <TabsContent value="crypto" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                    <CryptoTransferForm user={user!} type="deposit" />
                </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="bg-zinc-50 border-t py-4 justify-center gap-6 grayscale opacity-50">
                <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">{t('encryptionBadge', 'Cryptage Souverain 256-bit')}</span>
                </div>
                <div className="flex items-center gap-4">
                    <Image src="/logos/visa.png" alt="Visa" width={35} height={12} />
                    <Image src="/logos/mc.png" alt="Mastercard" width={25} height={15} />
                </div>
          </CardFooter>
        </Card>
    </div>
  );
}
