

'use client';

import * as React from 'react';
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CashToBankForm } from './cash-to-bank-form';
import type { User, Currency, Country } from '@/lib/types';
import { Landmark, Smartphone, Banknote, ArrowLeft, ShieldCheck, Loader2, Bitcoin, Building } from 'lucide-react';
import { CashToWallet131Form } from './wallet131-transfer-forms';
import { AirtelTransferForm } from './airtel-transfer-form';
import { AtmWithdrawalForm } from './atm-withdrawal-form';
import { MpesaTransferForm } from "./mpesa-transfer-form";
import { MtnTransferForm } from "./mtn-transfer-form";
import { CryptoTransferForm } from "./crypto-transfer-form"; 
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import { Separator } from "../ui/separator";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { processAirtelRemittance, processMpesaPayout, processMtnPayout } from "@/lib/actions/bank.actions";
import Image from "next/image";
import { EcobankTransferForm } from "./ecobank-transfer-form";
import { UbaTransferForm } from './uba-transfer-form';

type ServiceOption = 'standard_bank' | 'atm' | 'airtel' | 'mpesa' | 'mtn' | 'wallet131' | 'crypto' | 'ecobank' | 'uba';

export interface PayoutDetails {
    amount: number;
    currency: string;
    fee: number;
    recipientName: string;
    recipientIdentifier: string; // Phone number for mobile money
    provider: 'airtel' | 'mpesa' | 'mtn';
}

const pinSchema = z.object({
    pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

interface Service {
    id: ServiceOption;
    title: string;
    description: string;
    icon: React.ElementType;
    component: React.ReactNode;
}

const ServiceCard = ({ icon: Icon, title, description, onClick, disabled }: { icon: React.ElementType, title: string, description: string, onClick: () => void, disabled?: boolean }) => (
    <Card 
        onClick={onClick}
        className={cn(
            "cursor-pointer hover:border-primary hover:shadow-lg transition-all",
            disabled && "opacity-50 cursor-not-allowed hover:border-border hover:shadow-none"
        )}
    >
        <CardHeader className="flex flex-row items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Icon className="h-6 w-6 text-primary"/>
            </div>
            <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
        </CardHeader>
    </Card>
);

const BankSelection = ({ onSelectBank }: { onSelectBank: (bankName: string) => void }) => {
    const { t } = useTranslation();
    
    const SUPPORTED_BANKS = [
        { id: 'equity', name: 'Equity Bank', logo: 'https://placehold.co/40x40.png', hint: 'equity bank logo' },
        { id: 'ecobank', name: 'Ecobank', logo: 'https://placehold.co/40x40.png', hint: 'ecobank logo' },
        { id: 'uba', name: 'UBA', logo: 'https://placehold.co/40x40.png', hint: 'uba bank logo' },
        { id: 'rawbank', name: 'Rawbank', logo: 'https://placehold.co/40x40.png', hint: 'rawbank logo' },
    ];
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Choisir une banque</CardTitle>
                <CardDescription>Sélectionnez la banque de destination pour votre virement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {SUPPORTED_BANKS.map(bank => (
                    <div key={bank.id} onClick={() => onSelectBank(bank.name)} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted cursor-pointer">
                        <Image src={bank.logo} alt={bank.name} width={40} height={40} data-ai-hint={bank.hint} />
                        <div>
                            <h3 className="font-semibold">{bank.name}</h3>
                            <p className="text-xs text-muted-foreground">Virement direct via API partenaire.</p>
                        </div>
                    </div>
                ))}
                <div onClick={() => onSelectBank('Other')} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted cursor-pointer">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                        <Building className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Autre Banque</h3>
                        <p className="text-xs text-muted-foreground">Traitement manuel sous 24-48h.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


export function BankTransferClient({ user, currencies, countries }: { user: User, currencies: Currency[], countries: Country[] }) {
    const { t } = useTranslation();
    const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const { openAlert } = useAlertDialog();
    const [selectedBank, setSelectedBank] = useState<string | null>(null);

    const processPayment = async (details: PayoutDetails & { pin: string }) => {
        if (!user) return;
        setIsProcessing(true);
        
        let result;
        if(details.provider === 'airtel') {
            result = await processAirtelRemittance({ 
                user, 
                amount: details.amount,
                currency: details.currency as 'USD' | 'CDF',
                recipientPhone: details.recipientIdentifier,
                recipientName: details.recipientName,
                pin: details.pin,
                fee: details.fee,
            });
        } else if (details.provider === 'mpesa') {
             result = await processMpesaPayout({ 
                user, 
                amount: details.amount,
                currency: details.currency as 'USD' | 'CDF',
                recipientPhone: details.recipientIdentifier,
                recipientName: details.recipientName,
                reference: `MPESA_${Date.now()}`,
                pin: details.pin,
                fee: details.fee,
            });
        } else if (details.provider === 'mtn') {
            result = await processMtnPayout({
                user,
                amount: details.amount,
                currency: details.currency as 'USD' | 'CDF',
                recipientPhone: details.recipientIdentifier,
                recipientName: details.recipientName,
                reference: `MTN_${Date.now()}`,
                pin: details.pin,
                fee: details.fee,
            });
        }

        if (result?.success) {
            openAlert({
                title: "Transfert Réussi",
                description: `Votre transfert de ${details.amount} ${details.currency} a été initié avec succès.`,
                variant: "success",
            });
            setSelectedService(null); // Go back to selection
        } else {
             openAlert({
                title: "Échec du Transfert",
                description: result?.error || "Une erreur inconnue est survenue.",
                variant: "error"
             });
        }
        
        setIsProcessing(false);
    }
    
    const services: Service[] = [
        { id: 'standard_bank', title: 'Virement Bancaire', description: 'Transférez vers un compte bancaire local.', icon: Landmark, component: <div /> },
        { id: 'atm', title: 'Retrait GAB', description: 'Générez un code pour un retrait sans carte.', icon: Banknote, component: <AtmWithdrawalForm user={user} currencies={currencies} /> },
        { id: 'airtel', title: 'Airtel Money', description: 'Envoyez directement vers un portefeuille Airtel.', icon: Smartphone, component: <AirtelTransferForm user={user} currencies={currencies} onProceed={processPayment} /> },
        { id: 'mpesa', title: 'M-Pesa', description: 'Envoyez directement vers un portefeuille M-Pesa.', icon: Smartphone, component: <MpesaTransferForm user={user} currencies={currencies} onProceed={processPayment} /> },
        { id: 'mtn', title: 'MTN MoMo', description: 'Envoyez directement vers un portefeuille MTN.', icon: Smartphone, component: <MtnTransferForm user={user} currencies={currencies} onProceed={processPayment} /> },
        { id: 'ecobank', title: 'Ecobank', description: 'Retrait GAB Xpress Cash ou virement.', icon: Landmark, component: <EcobankTransferForm user={user} currencies={currencies} countries={countries} /> },
        { id: 'uba', title: 'UBA', description: 'Virement vers un compte UBA.', icon: Landmark, component: <UbaTransferForm user={user} currencies={currencies} /> },
        { id: 'wallet131', title: 'Wallet 131', description: 'Transférez des fonds vers la Russie.', icon: Landmark, component: <CashToWallet131Form user={user} currencies={currencies} /> },
        { id: 'crypto', title: 'Retrait Crypto', description: 'Transférez vos fonds vers un portefeuille externe BTC, ETH ou USDT.', icon: Bitcoin, component: <CryptoTransferForm user={user} type="withdrawal" currencies={currencies} /> },
    ];
    
    const activeService = services.find(s => s.id === selectedService);

    const handleBack = () => {
        if (selectedBank) {
            setSelectedBank(null);
        } else {
            setSelectedService(null);
        }
    };
    
    const handleSelectService = (serviceId: ServiceOption) => {
        setSelectedService(serviceId);
    }
    
    const renderContent = () => {
        if (!activeService) {
            return (
                 <motion.div
                    key="selection"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                >
                    {services.map(service => (
                        <ServiceCard 
                            key={service.id} 
                            {...service} 
                            onClick={() => handleSelectService(service.id)} 
                        />
                    ))}
                </motion.div>
            );
        }

        let componentToRender;
        if (activeService.id === 'standard_bank') {
            if (!selectedBank) {
                componentToRender = <BankSelection onSelectBank={setSelectedBank} />;
            } else if (selectedBank === 'UBA') {
                 componentToRender = <UbaTransferForm user={user} currencies={currencies} />;
            } else {
                componentToRender = <CashToBankForm user={user} currencies={currencies} bankName={selectedBank !== 'Other' ? selectedBank : undefined} />;
            }
        } else {
            componentToRender = React.cloneElement(activeService.component as React.ReactElement, { isProcessing });
        }

        return (
             <motion.div
                key={selectedService ? (selectedBank ? `${selectedService}-${selectedBank}` : selectedService) : 'empty'}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
            >
                 <div className="mb-4">
                    <Button variant="ghost" onClick={handleBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Retour à la sélection
                    </Button>
                </div>
                {componentToRender}
            </motion.div>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground">Retrait & Virement Bancaire</h1>
                    <p className="text-muted-foreground mt-2">Retirez des fonds de votre portefeuille CashPay vers un compte bancaire ou un service partenaire.</p>
                </div>
                 <AnimatePresence mode="wait">
                    {renderContent()}
                </AnimatePresence>
            </div>
        </main>
    )
}
```
  </change>
  <change>
    <file>src/components/events/layout.tsx</file>
    <content><