

'use client';

import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { registerLoanMePartner } from "@/lib/actions/loanme.actions";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

const formSchema = z.object({
  companyName: z.string().min(3, "Le nom de l'entreprise est requis."),
  companyType: z.string({ required_error: "Veuillez sélectionner un type d'établissement." }),
  rccm: z.string().min(1, "Le numéro RCCM est requis."),
  nationalId: z.string().min(1, "L'ID National est requis."),
  address: z.string().min(10, "L'adresse est requise."),
});

const RegisterForm = () => {
    const { t } = useTranslation('MLM');
    const { openAlert } = useAlertDialog();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {},
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSubmitting(true);
        const user = await getAuthenticatedUser();
        if (!user) {
            openAlert({ title: "Erreur", description: "Utilisateur non authentifié.", variant: "error" });
            setIsSubmitting(false);
            return;
        }
        
        const result = await registerLoanMePartner(user.id, values);

        if (result.success) {
            openAlert({
                title: t('mlmLoanMeRegisterSuccessTitle'),
                description: t('mlmLoanMeRegisterSuccessDesc', { companyName: values.companyName }),
                variant: 'success'
            });
            router.push('/mlm/loanme');
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
        setIsSubmitting(false);
    };

    return (
         <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem><FormLabel>{t('companyNameLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="companyType" render={({ field }) => ( 
                    <FormItem>
                        <FormLabel>{t('companyTypeLabel', 'Type d\'établissement')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder={t('selectPlaceholder', 'Sélectionnez un type')} /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="ONG">ONG</SelectItem>
                                <SelectItem value="Societe">Société (SARL, SA, etc.)</SelectItem>
                                <SelectItem value="Etablissement">Établissement</SelectItem>
                                <SelectItem value="Microfinance">Micro-finance</SelectItem>
                                <SelectItem value="Banque">Banque</SelectItem>
                                <SelectItem value="Autre">Autre</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem> 
                )} />
                <FormField control={form.control} name="rccm" render={({ field }) => ( <FormItem><FormLabel>{t('rccmLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="nationalId" render={({ field }) => ( <FormItem><FormLabel>{t('nationalIdLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>{t('addressLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <Button type="submit" className="w-full" disabled={isSubmitting}>{t('submitButton', 'Soumettre la demande')}</Button>
            </form>
        </Form>
    );
};

export default function LoanMeRegisterPage() {
    const { t } = useTranslation('MLM');

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                 <div className="max-w-2xl mx-auto space-y-4">
                     <Button asChild variant="ghost">
                        <Link href="/mlm/loanme"><ArrowLeft className="mr-2 h-4 w-4" /> {t('backButton', 'Retour')}</Link>
                     </Button>
                     <Card>
                        <CardHeader>
                            <CardTitle>{t('mlmLoanMeRegisterTitle')}</CardTitle>
                            <CardDescription>{t('mlmLoanMeRegisterDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RegisterForm />
                        </CardContent>
                     </Card>
                </div>
            </main>
        </DashboardLayout>
    );
}
