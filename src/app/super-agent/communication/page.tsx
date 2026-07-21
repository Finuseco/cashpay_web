
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Megaphone, Send, Mail, MessageSquare, Phone, ShieldCheck, Loader2, Info, Users } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { sendMassCommunication } from '@/lib/actions/super-agent/staff.actions';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const commSchema = z.object({
    channel: z.enum(['sms', 'email', 'whatsapp']),
    subject: z.string().min(5, "Le sujet est requis."),
    message: z.string().min(10, "Le message doit contenir au moins 10 caractères."),
    pin: z.string().length(4, "Le PIN est requis."),
});

export default function MassCommunicationPage() {
    const { openAlert } = useAlertDialog();
    const [superAgent, setSuperAgent] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof commSchema>>({
        resolver: zodResolver(commSchema),
        defaultValues: {
            channel: 'sms',
            subject: 'Alerte CashPay',
            message: '',
            pin: '',
        }
    });

    useEffect(() => {
        getAuthenticatedUser().then(setSuperAgent);
    }, []);

    const onSubmit = async (values: z.infer<typeof commSchema>) => {
        if (!superAgent) return;

        openAlert({
            title: "Confirmer l'envoi massif ?",
            description: `Vous êtes sur le point d'envoyer ce message à TOUS les utilisateurs actifs du pays : ${superAgent.country}. Cette action est irréversible.`,
            variant: "warning",
            showCancel: true,
            confirmText: "Oui, Envoyer maintenant",
            onClose: async (confirmed) => {
                if (confirmed) {
                    setIsSubmitting(true);
                    const result = await sendMassCommunication({
                        adminId: superAgent.id,
                        channel: values.channel,
                        subject: values.subject,
                        message: values.message,
                        pin: values.pin
                    });
                    setIsSubmitting(false);

                    if (result.success) {
                        openAlert({
                            title: "Envoi Terminé",
                            description: `Votre message a été transmis avec succès à ${result.count} utilisateurs.`,
                            variant: 'success'
                        });
                        form.reset({ pin: '', message: '', channel: 'sms', subject: 'Alerte CashPay' });
                    } else {
                        openAlert({ title: "Échec", description: result.error, variant: 'error' });
                    }
                }
            }
        });
    };

    const selectedChannel = form.watch('channel');

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Megaphone className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Communication de Masse</h1>
                    <p className="text-sm text-zinc-400">Envoyez des alertes ou promotions à tout votre territoire.</p>
                </div>
            </div>

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Nouvelle Annonce Nationale</CardTitle>
                    <CardDescription className="text-zinc-400">
                        Cible : Tous les utilisateurs actifs en <strong>{superAgent?.country}</strong>.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="channel"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Canal de diffusion</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="grid grid-cols-3 gap-4"
                                            >
                                                <div className={cn("flex items-center space-x-2 border border-zinc-700 p-3 rounded-lg cursor-pointer", field.value === 'sms' && "border-primary bg-primary/5")}>
                                                    <RadioGroupItem value="sms" id="sms" />
                                                    <Label htmlFor="sms" className="flex items-center gap-2 cursor-pointer"><MessageSquare className="h-4 w-4"/> SMS</Label>
                                                </div>
                                                <div className={cn("flex items-center space-x-2 border border-zinc-700 p-3 rounded-lg cursor-pointer", field.value === 'email' && "border-primary bg-primary/5")}>
                                                    <RadioGroupItem value="email" id="email" />
                                                    <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer"><Mail className="h-4 w-4"/> E-mail</Label>
                                                </div>
                                                <div className={cn("flex items-center space-x-2 border border-zinc-700 p-3 rounded-lg cursor-pointer", field.value === 'whatsapp' && "border-primary bg-primary/5")}>
                                                    <RadioGroupItem value="whatsapp" id="whatsapp" />
                                                    <Label htmlFor="whatsapp" className="flex items-center gap-2 cursor-pointer"><Phone className="h-4 w-4"/> WhatsApp</Label>
                                                </div>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {selectedChannel === 'email' && (
                                <FormField
                                    control={form.control}
                                    name="subject"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sujet de l'e-mail</FormLabel>
                                            <FormControl><Input placeholder="Ex: Maintenance système ou Promo flash" {...field} className="bg-zinc-900 border-zinc-700" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <FormField
                                control={form.control}
                                name="message"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contenu du message</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder="Saisissez votre message ici..." 
                                                className="min-h-[150px] bg-zinc-900 border-zinc-700" 
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormDescription className="text-zinc-500">
                                            {selectedChannel === 'sms' ? "Limite conseillée : 160 caractères pour un SMS standard." : "Texte riche supporté pour l'e-mail."}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Separator className="bg-zinc-700" />

                            <div className="flex flex-col items-center space-y-4">
                                <FormField
                                    control={form.control}
                                    name="pin"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-center block">PIN Super Agent pour validation</FormLabel>
                                            <FormControl>
                                                <div className="flex justify-center">
                                                    <InputOTP maxLength={4} {...field}>
                                                        <InputOTPGroup>
                                                            <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                                                        </InputOTPGroup>
                                                    </InputOTP>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" variant="gradient" className="w-full h-12 font-bold text-lg" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                                    Diffuser l'annonce nationale
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle>Responsabilité de diffusion</AlertTitle>
                <AlertDescription className="text-xs text-zinc-400">
                    L'utilisation abusive de cet outil peut entraîner la suspension de vos droits de Super Agent. Assurez-vous que le message est conforme à la politique de communication de CashPay.
                </AlertDescription>
            </Alert>
        </div>
    );
}
