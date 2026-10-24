
'use client';

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { Loader2, ShieldCheck, CreditCard, Lock, User as UserIcon } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import Image from "next/image";

const depositSchema = z.object({
  amount: z.coerce.number().min(1, "Le montant doit être supérieur à 0."),
  currency: z.string().default('USD'),
  cardHolderName: z.string().min(3, "Nom du titulaire requis."),
  cardNumber: z.string().min(13, "Numéro de carte invalide.").max(19),
  expiryDate: z.string().regex(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/, "Date invalide (MM/AA)."),
  cvv: z.string().min(3).max(4),
  saveCard: z.boolean().default(true),
});

export const CardDepositForm = ({ user, onSubmit, isSubmitting }: { user: User | null; onSubmit: (values: any) => void; isSubmitting: boolean }) => {
  const { t } = useTranslation();

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { 
        currency: 'USD',
        cardHolderName: user?.full_name || '',
        saveCard: true,
    }
  });

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0">
        <CardTitle className="text-xl flex items-center gap-2">
            <CreditCard className="text-primary"/> {t('cardDepositTitle')}
        </CardTitle>
        <CardDescription>
            {t('cardDepositDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('depositAmountLabel', 'Montant')}</FormLabel>
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
                            <FormLabel>{t('depositCurrencyLabel', 'Devise')}</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-2 h-12 items-center">
                                    {['USD', 'EUR'].map(c => (
                                        <div key={c} className="flex items-center">
                                            <RadioGroupItem value={c} id={`card-cur-${c}`} className="sr-only" />
                                            <Label htmlFor={`card-cur-${c}`} className={`flex items-center justify-center h-10 px-4 border-2 rounded-lg cursor-pointer font-bold text-sm transition-all ${field.value === c ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-200 text-zinc-400'}`}>{c}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="space-y-4">
                <FormField control={form.control} name="cardHolderName" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('cardHolderLabel', 'Nom sur la carte')}</FormLabel>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/>
                            <FormControl><Input placeholder="NOM COMPLET" {...field} className="pl-10 h-11 uppercase font-bold"/></FormControl>
                        </div>
                        <FormMessage/>
                    </FormItem>
                )}/>
                <FormField control={form.control} name="cardNumber" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('cardNumberLabel', 'Numéro de carte')}</FormLabel>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/>
                            <FormControl><Input placeholder="0000 0000 0000 0000" {...field} maxLength={19} className="pl-10 h-11 font-mono tracking-widest"/></FormControl>
                        </div>
                        <FormMessage/>
                    </FormItem>
                )}/>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="expiryDate" render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('expiryDateLabel', 'Expiration (MM/AA)')}</FormLabel>
                            <FormControl><Input placeholder="MM/AA" {...field} className="h-11 font-mono text-center"/></FormControl>
                            <FormMessage/>
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="cvv" render={({ field }) => (
                        <FormItem>
                            <FormLabel>CVV</FormLabel>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/>
                                <FormControl><Input type="password" placeholder="***" {...field} maxLength={4} className="pl-10 h-11 font-mono text-center"/></FormControl>
                            </div>
                            <FormMessage/>
                        </FormItem>
                    )}/>
                </div>
                
                <FormField
                    control={form.control}
                    name="saveCard"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-xl border p-4 bg-muted/20">
                            <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="text-xs cursor-pointer">
                                    {t('saveCardLabel', 'Sauvegarder pour de futurs paiements')}
                                </FormLabel>
                            </div>
                        </FormItem>
                    )}
                />
            </div>

            <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                {t('depositConfirmButton', "VALIDER L'APPROVISIONNEMENT")}
            </Button>
            
            <div className="flex justify-center items-center gap-4 opacity-50 grayscale pt-2">
                <Image src="/logos/visa.png" alt="Visa" width={40} height={15} />
                <Image src="/logos/mc.png" alt="Mastercard" width={30} height={20} />
                <Image src="/logos/maxicash.png" alt="MaxiCash" width={60} height={15} />
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
