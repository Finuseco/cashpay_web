
'use client';

import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceGroup, ChoiceContent, ChoiceItem, ChoiceTrigger, ChoiceValue } from "@/components/ui/choice-group";
import { registerMlmPartner } from "@/lib/actions/mlm.actions";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";


const formSchema = z.object({
  companyName: z.string().min(3, "Le nom de l'entreprise est requis."),
  companyType: z.string({ required_error: "Veuillez sélectionner un type d'établissement." }),
  productCategory: z.string({ required_error: "La catégorie de produits est requise." }),
  commissionCurrency: z.string({ required_error: "La devise des commissions est requise." }),
  website: z.string().url("Veuillez entrer une URL valide.").optional().or(z.literal('')),
  description: z.string().min(20, "Veuillez fournir une brève description de votre entreprise et de vos produits."),
});

const RegisterForm = () => {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            commissionCurrency: "USD"
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSubmitting(true);
        const user = await getAuthenticatedUser();
        if(!user) {
             openAlert({ title: "Erreur", description: "Utilisateur non authentifié.", variant: "error" });
             setIsSubmitting(false);
             return;
        }

        const result = await registerMlmPartner(user.id, values);

        if (result.success) {
            openAlert({
                title: 'Demande Soumise',
                description: `Votre demande pour le programme de Marketing de Réseau a été envoyée. Vous serez notifié après examen.`,
                variant: 'success'
            });
            router.push('/mlm/network-marketing');
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
                        <FormLabel>Type d'établissement</FormLabel>
                        <ChoiceGroup onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><ChoiceTrigger><ChoiceValue placeholder="Sélectionnez un type" /></ChoiceTrigger></FormControl>
                            <ChoiceContent>
                                <ChoiceItem value="Usine de Production">Usine de Production</ChoiceItem>
                                <ChoiceItem value="Fabrication">Fabrication</ChoiceItem>
                                <ChoiceItem value="Agro-alimentaire">Agro-alimentaire</ChoiceItem>
                                <ChoiceItem value="Pharmacie">Pharmacie</ChoiceItem>
                                <ChoiceItem value="Revendeur">Revendeur / Distributeur</ChoiceItem>
                                <ChoiceItem value="Autre">Autre</ChoiceItem>
                            </ChoiceContent>
                        </ChoiceGroup>
                        <FormMessage />
                    </FormItem> 
                )} />
                 <FormField control={form.control} name="productCategory" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('productCategoryLabel')}</FormLabel>
                        <ChoiceGroup onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><ChoiceTrigger><ChoiceValue placeholder={t('productCategoryPlaceholder')} /></ChoiceTrigger></FormControl>
                            <ChoiceContent>
                                <ChoiceItem value="Cosmétiques">Cosmétiques</ChoiceItem>
                                <ChoiceItem value="Alimentaire & Boissons">Alimentaire & Boissons</ChoiceItem>
                                <ChoiceItem value="Chimique">Produits Chimiques / Entretien</ChoiceItem>
                                <ChoiceItem value="Mode">Mode & Habillement</ChoiceItem>
                                <ChoiceItem value="Technologie">Technologie & Électronique</ChoiceItem>
                                <ChoiceItem value="Autre">Autre</ChoiceItem>
                            </ChoiceContent>
                        </ChoiceGroup>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="commissionCurrency" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Devise des commissions</FormLabel>
                        <ChoiceGroup onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><ChoiceTrigger><ChoiceValue/></ChoiceTrigger></FormControl>
                            <ChoiceContent>
                                <ChoiceItem value="USD">USD</ChoiceItem>
                                <ChoiceItem value="CDF">CDF</ChoiceItem>
                            </ChoiceContent>
                        </ChoiceGroup>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="website" render={({ field }) => ( <FormItem><FormLabel>{t('websiteLabel')}</FormLabel><FormControl><Input placeholder="https://www.mon-entreprise.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>{t('descriptionLabel')}</FormLabel><FormControl><Textarea placeholder={t('descriptionPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem> )} />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  {t('submitApplicationButton')}
                </Button>
            </form>
        </Form>
    );
};

export default function NetworkMarketingRegisterPage() {
    const { t } = useTranslation();

    return (
        <DashboardLayout pageTitleKey="pageTitleNetworkMarketing">
            <main className="flex-1 p-4 md:p-8">
                 <div className="max-w-2xl mx-auto space-y-4">
                     <Button asChild variant="ghost">
                        <Link href="/mlm/network-marketing"><ArrowLeft className="mr-2 h-4 w-4" /> Retour</Link>
                     </Button>
                     <Card>
                        <CardHeader>
                            <CardTitle>{t('networkMarketingRegisterTitle')}</CardTitle>
                            <CardDescription>{t('networkMarketingRegisterDesc')}</CardDescription>
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
