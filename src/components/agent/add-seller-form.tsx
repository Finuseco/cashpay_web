
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCheck, Loader2 } from "lucide-react";
import type { VerifyUserOutput } from "@/ai/flows/verify-user-flow";
import type { Seller, Boutique } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { getWalletInfo } from "@/lib/actions/wallet.actions";

const formSchema = z.object({
  idWallet: z.string().regex(/^[A-Z]{2}\d{10}$/, { message: "Format d'ID de portefeuille invalide." }),
  phone: z.string().min(9, "Le numéro de téléphone est requis."),
  monthlySalary: z.coerce.number().min(0, "Le salaire doit être un nombre positif.").optional(),
  boutiqueId: z.string({ required_error: "Veuillez assigner une boutique." }),
  role: z.enum(['Vendeur', 'Gérant', 'Caissier'], { required_error: "Veuillez assigner un rôle." }),
});

interface AddSellerFormProps {
    onFormSubmit: (newSeller: Omit<Seller, 'createdAt' | 'totalSales'>) => void;
    boutiques: Boutique[];
}

export function AddSellerForm({ onFormSubmit, boutiques }: AddSellerFormProps) {
  const { t } = useTranslation();
  const [verification, setVerification] = useState<VerifyUserOutput | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      idWallet: '',
      phone: '',
      monthlySalary: undefined,
      role: 'Vendeur'
    },
  });

  const idWalletValue = form.watch('idWallet');

  const handleVerify = async () => {
    const walletId = form.getValues('idWallet');
    if (!/^[A-Z]{2}\d{10}$/.test(walletId)) {
        form.setError('idWallet', { type: 'manual', message: "Format d'ID de portefeuille invalide." });
        return;
    }
    
    setIsVerifying(true);
    setVerification(null);
    try {
        const result = await getWalletInfo(walletId);
        if(result.success) {
            setVerification({
                isValid: true,
                userName: result.userName || null,
                reason: 'ID valide.',
                userId: result.userId || 0,
                walletId: walletId,
                countryCode: result.countryCode || ''
            });
            form.clearErrors('idWallet');
        } else {
            const errorResult: VerifyUserOutput = { isValid: false, userName: null, reason: result.error || 'Erreur inconnue', userId: 0 };
            setVerification(errorResult);
            form.setError('idWallet', { type: 'manual', message: errorResult.reason });
        }
    } catch (e) {
        console.error(e);
        form.setError('idWallet', { type: 'manual', message: "An error occurred during verification." });
    } finally {
        setIsVerifying(false);
    }
  };


  function handleSubmit(values: z.infer<typeof formSchema>) {
    if (verification?.isValid && verification.userName) {
        onFormSubmit({ 
            id: verification.userId,
            fullName: verification.userName,
            id_wallet: values.idWallet,
            phone: values.phone,
            status: 'Active',
            profile_photo: `https://placehold.co/40x40.png`,
            boutiqueId: values.boutiqueId,
            role: values.role,
            monthlySalary: values.monthlySalary,
        });
        form.reset();
        setVerification(null);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="idWallet"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('addSellerFormWalletIdLabel')}</FormLabel>
              <FormDescription>{t('addSellerFormWalletIdDesc')}</FormDescription>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input placeholder="CD0123456789" {...field} />
                </FormControl>
                <Button type="button" onClick={handleVerify} disabled={isVerifying || !idWalletValue}>
                    {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('verifyButton')}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {verification?.isValid && verification.walletId === idWalletValue && (
            <div className="flex items-center gap-3 rounded-lg border bg-green-50 border-green-200 p-3 text-sm text-green-800">
                <UserCheck className="h-5 w-5"/>
                <span className="font-semibold">{verification.userName}</span>
            </div>
        )}

        <FormField
          control={form.control}
          name="boutiqueId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('addSellerFormAssignBoutique')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('addSellerFormSelectBoutique')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {boutiques.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('addSellerFormRole')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('addSellerFormSelectRole')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Vendeur">{t('roleSeller')}</SelectItem>
                  <SelectItem value="Gérant">{t('roleManager')}</SelectItem>
                  <SelectItem value="Caissier">{t('roleCashier')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('addSellerFormPhone')}</FormLabel>
               <FormControl>
                <Input type="tel" placeholder={t('addSellerFormPhonePlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="monthlySalary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('addSellerFormSalary')}</FormLabel>
              <FormControl>
                <Input type="number" placeholder={t('addSellerFormSalaryPlaceholder')} {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="gradient" className="w-full font-bold" disabled={!verification?.isValid || verification.walletId !== idWalletValue}>
          {t('addSellerFormSubmit')}
        </Button>
      </form>
    </Form>
  );
}

    