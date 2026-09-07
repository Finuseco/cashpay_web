
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User, SavedCard } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Loader2, ArrowRight, CreditCard, Lock, Calendar, User as UserIcon, Plus, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Checkbox } from "../ui/checkbox";
import { getSavedUserCards } from "@/lib/actions/card.actions";
import { useRouter } from "next/navigation";

const amountSchema = z.object({
  amount: z.coerce.number().min(1, "Le montant doit être supérieur à 0."),
  currency: z.string().default('USD'),
});

const cardDetailsSchema = z.object({
  cardHolderName: z.string().min(3, "Le nom du titulaire est requis."),
  cardNumber: z.string().min(13, "Numéro de carte invalide.").max(19, "Numéro de carte invalide."),
  expiryDate: z.string().regex(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/, "Date invalide (MM/AA)."),
  cvv: z.string().min(3, "CVV invalide.").max(4, "CVV invalide."),
  saveCard: z.boolean().default(false).optional(),
});

type CardFormValues = z.infer<typeof amountSchema> & z.infer<typeof cardDetailsSchema>;

const detectCardBrand = (cardNumber: string): 'visa' | 'mastercard' | 'unknown' => {
    if (/^4/.test(cardNumber)) return 'visa';
    if (/^5[1-5]/.test(cardNumber)) return 'mastercard';
    return 'unknown';
}

export const CardDepositForm = ({ user, onSubmit, isSubmitting }: { user: User | null; onSubmit: (values: any) => Promise<void>; isSubmitting: boolean }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'amount' | 'details'>('amount');
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedSavedCard, setSelectedSavedCard] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (user) {
        getSavedUserCards(user.id).then(setSavedCards);
    }
  }, [user]);
  
  const form = useForm<CardFormValues>({
    resolver: zodResolver(amountSchema.merge(cardDetailsSchema)),
    defaultValues: { 
        currency: 'USD',
        amount: undefined, 
        cardHolderName: user?.full_name || '',
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        saveCard: true,
    }
  });
  
  const handleAmountSubmit = async () => {
      const result = await form.trigger(['amount', 'currency']);
      if (result) {
          if (savedCards.length > 0) {
            setStep('details');
          } else {
            setSelectedSavedCard('new');
            setStep('details');
          }
      }
  }

  const handleSavedCardSubmit = () => {
    const savedCard = savedCards.find(acc => acc.id.toString() === selectedSavedCard);
    if (savedCard) {
      const [expMonth, expYear] = [savedCard.expiry_month, savedCard.expiry_year.slice(-2)];
      const values = {
        ...form.getValues(),
        cardHolderName: savedCard.card_holder_name,
        cardNumber: savedCard.card_token,
        expiryDate: `${expMonth}/${expYear}`,
        cvv: '***',
      };
      onSubmit(values);
    }
  };

  const cardNumber = form.watch('cardNumber');
  const cardBrand = detectCardBrand(cardNumber);

  if (step === 'details' && savedCards.length > 0 && !selectedSavedCard) {
      return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Utiliser une carte enregistrée</p>
              {savedCards.map(card => (
                <div key={card.id} onClick={() => setSelectedSavedCard(card.id.toString())} className="p-4 border rounded-xl cursor-pointer hover:border-primary bg-background flex items-center justify-between transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-zinc-400 group-hover:text-primary"/>
                        </div>
                        <div>
                            <p className="font-bold text-sm">{card.card_brand.toUpperCase()} •••• {card.last4}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{card.card_holder_name}</p>
                        </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed h-12" onClick={() => setSelectedSavedCard('new')}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter une nouvelle carte
              </Button>
          </div>
      );
  }
  
  if (selectedSavedCard && selectedSavedCard !== 'new') {
    const card = savedCards.find(acc => acc.id.toString() === selectedSavedCard);
    return (
      <div className="space-y-6 text-center animate-in zoom-in-95">
        <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20 inline-block w-full">
            <p className="text-sm text-muted-foreground">Débit sur la carte enregistrée</p>
            <p className="text-xl font-black mt-1 uppercase">{card?.card_brand} •••• {card?.last4}</p>
        </div>
        <Button onClick={handleSavedCardSubmit} className="w-full h-14 text-lg font-black shadow-xl" variant="gradient" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
            PAYER {form.getValues('amount')} {form.getValues('currency')}
        </Button>
         <Button variant="ghost" className="text-xs text-muted-foreground" onClick={() => setSelectedSavedCard(null)}>Changer de méthode</Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {step === 'amount' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Montant</FormLabel>
                        <FormControl><Input type="number" placeholder="0.00" {...field} value={field.value || ''} className="h-12 text-lg font-bold" /></FormControl>
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
                            <FormControl><SelectTrigger className="h-12 font-semibold"><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <Button type="button" onClick={handleAmountSubmit} className="w-full h-12 text-lg font-bold" variant="gradient">
                    Continuer <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
            </div>
        )}

        {step === 'details' && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <FormField control={form.control} name="cardHolderName" render={({ field }) => (
                    <FormItem><FormLabel>Nom sur la carte</FormLabel><div className="relative"><UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/><FormControl><Input placeholder="NOM COMPLET" {...field} className="pl-10 h-11 uppercase font-bold"/></FormControl></div><FormMessage/></FormItem>
                )}/>
                 <FormField control={form.control} name="cardNumber" render={({ field }) => (
                    <FormItem><FormLabel>Numéro de carte</FormLabel>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/>
                            <FormControl><Input placeholder="0000 0000 0000 0000" {...field} maxLength={19} className="pl-10 h-11 font-mono tracking-widest"/></FormControl>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {cardBrand === 'visa' && <Image src="/logos/visa.png" alt="Visa" width={32} height={10}/>}
                                {cardBrand === 'mastercard' && <Image src="/logos/mc.png" alt="Mastercard" width={32} height={20}/>}
                            </div>
                        </div>
                        <FormMessage/>
                    </FormItem>
                 )}/>
                 <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="expiryDate" render={({ field }) => (
                        <FormItem><FormLabel>Expiration (MM/AA)</FormLabel><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/><FormControl><Input placeholder="MM/AA" {...field} className="pl-10 h-11 font-mono"/></FormControl></div><FormMessage/></FormItem>
                     )}/>
                     <FormField control={form.control} name="cvv" render={({ field }) => (
                        <FormItem><FormLabel>CVV</FormLabel><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/><FormControl><Input type="password" placeholder="***" {...field} maxLength={4} className="pl-10 h-11 font-mono"/></FormControl></div><FormMessage/></FormItem>
                     )}/>
                 </div>
                 <FormField
                    control={form.control}
                    name="saveCard"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border p-4 bg-muted/20">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs cursor-pointer">
                                Sauvegarder pour de futurs paiements instantanés
                            </FormLabel>
                        </div>
                        </FormItem>
                    )}
                />
                <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                    VALIDER LE PAIEMENT
                </Button>
                <div className="text-center">
                    <Button variant="link" className="text-xs text-muted-foreground" onClick={() => setStep('amount')}>Retour au montant</Button>
                </div>
            </div>
        )}
      </form>
    </Form>
  )
}
