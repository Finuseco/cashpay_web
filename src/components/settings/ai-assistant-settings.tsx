'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from "react-i18next";
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Bot, Save } from 'lucide-react';
import type { User } from '@/lib/types';

const weekdays = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const formSchema = z.object({
  isEnabled: z.boolean(),
  customMessage: z.string().max(500, "Le message ne peut pas dépasser 500 caractères."),
  activeDays: z.array(z.string()),
});

type AssistantSettings = z.infer<typeof formSchema>;

export function AiAssistantSettings({ user }: { user: User | null }) {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const [isClient, setIsClient] = useState(false);
    
    const form = useForm<AssistantSettings>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            isEnabled: false,
            customMessage: "Bonjour, je suis actuellement occupé. Merci de me laisser un message. Je vous recontacte dès que possible.",
            activeDays: [],
        },
    });
    
    useEffect(() => {
        setIsClient(true);
        if (user?.assistantSettings) {
            form.reset(user.assistantSettings);
        }
    }, [form, user]);

    const onSubmit = (values: AssistantSettings) => {
        const savedSettingsRaw = localStorage.getItem('cashpay-user-profile');
        const userProfile = savedSettingsRaw ? JSON.parse(savedSettingsRaw) : {};
        const updatedProfile = { ...userProfile, assistantSettings: values };
        localStorage.setItem('cashpay-user-profile', JSON.stringify(updatedProfile));
        
        openAlert({
            title: 'Paramètres Enregistrés',
            description: 'Les paramètres de votre assistant AI ont été mis à jour.',
            variant: 'success',
        });
    };

    if (!isClient) return null;

    return (
        <div className="space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Bot className="h-6 w-6 text-muted-foreground" />
                    <div>
                        <p className="font-semibold">{t('securityAiAssistantTitle')}</p>
                        <p className="text-sm text-muted-foreground">
                           Configurez des réponses automatiques en votre absence.
                        </p>
                    </div>
                </div>
            </div>

            <div className="pl-10 space-y-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="isEnabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">{t('assistantEnableLabel')}</FormLabel>
                                        <FormDescription>{t('assistantEnableDescription')}</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="customMessage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('assistantResponseMessageLabel')}</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} rows={4} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="activeDays"
                            render={() => (
                                <FormItem>
                                    <FormLabel>{t('assistantActiveDaysLabel')}</FormLabel>
                                    <FormDescription>{t('assistantActiveDaysDescription')}</FormDescription>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                                        {weekdays.map((day) => (
                                            <FormField
                                                key={day}
                                                control={form.control}
                                                name="activeDays"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(day)}
                                                                onCheckedChange={(checked) => {
                                                                    const currentDays = field.value || [];
                                                                    const updatedDays = checked
                                                                        ? [...currentDays, day]
                                                                        : currentDays.filter((value) => value !== day);
                                                                    field.onChange(updatedDays);
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">{day}</FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <Button type="submit">
                            <Save className="mr-2 h-4 w-4" /> {t('saveSettingsButton')}
                        </Button>
                    </form>
                </Form>
            </div>
        </div>
    );
}
