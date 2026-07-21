

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useRouter } from 'next/navigation';
import { orderStarlinkInstallation } from '@/lib/actions/starlink.actions';
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  customerName: z.string().min(3, "Le nom du client est requis."),
  customerPhone: z.string().min(9, "Le numéro de téléphone est requis."),
  installationAddress: z.string().min(10, "L'adresse d'installation est requise."),
  notes: z.string().optional(),
});

export default function StarlinkInstallPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();
    const { t } = useTranslation();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            customerName: '',
            customerPhone: '',
            installationAddress: '',
            notes: '',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const result = await orderStarlinkInstallation(values);
        setIsLoading(false);

        if (result.success) {
            openAlert({
                title: t('orderSuccessTitle'),
                description: t('orderSuccessDescription', {name: values.customerName, orderId: result.data?.orderId}),
                variant: 'success',
                onClose: () => router.push('/starlink/dashboard')
            });
        } else {
            openAlert({ title: t('errorTitle'), description: result.error, variant: 'error' });
        }
    };

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => router.back()}>
                            <ArrowLeft />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">{t('starlinkInstallTitle')}</h1>
                            <p className="text-muted-foreground">{t('starlinkInstallDescription')}</p>
                        </div>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('customerInfoTitle')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <FormField control={form.control} name="customerName" render={({ field }) => ( <FormItem><FormLabel>{t('customerNameLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                    <FormField control={form.control} name="customerPhone" render={({ field }) => ( <FormItem><FormLabel>{t('customerPhoneLabel')}</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                    <FormField control={form.control} name="installationAddress" render={({ field }) => ( <FormItem><FormLabel>{t('customerAddressLabel')}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                    <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>{t('notesLabel')}</FormLabel><FormControl><Textarea placeholder={t('notesPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                    <Button type="submit" variant="gradient" className="w-full" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {t('submitOrderButton')}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </DashboardLayout>
    );
}
