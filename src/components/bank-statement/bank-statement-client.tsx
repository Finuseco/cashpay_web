
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, subDays } from 'date-fns';
import { Calendar as CalendarIcon, FileText, Loader2, ShieldCheck, ArrowLeft, Printer, Download } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { useTranslation } from "react-i18next";

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { requestBankStatement } from '@/lib/actions/statement.actions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { getUserTransactions } from '@/lib/actions/transaction.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { User, Transaction } from '@/lib/types';
import { StatementDisplay } from './statement-display';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';

const STATEMENT_FEE = 1;

const formSchema = z.object({
  dateRange: z.object({
    from: z.date({ required_error: "Une date de début est requise." }),
    to: z.date({ required_error: "Une date de fin est requise." }),
  }),
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

type Step = 'date' | 'statement';

export function BankStatementClient() {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('date');
    const [user, setUser] = useState<User | null>(null);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    
    useEffect(() => {
      const fetchUser = async () => {
        const fetchedUser = await getAuthenticatedUser();
        setUser(fetchedUser);
      };
      fetchUser();
    }, []);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            dateRange: {
                from: subDays(new Date(), 30),
                to: new Date(),
            },
        },
    });

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
        defaultValues: { pin: "" },
    });

    const handleDateSubmit = (values: z.infer<typeof formSchema>) => {
        setIsPinDialogOpen(true);
    };

    const handlePinSubmit = async (values: z.infer<typeof pinSchema>) => {
        setIsLoading(true);
        setIsPinDialogOpen(false);
    
        const pinResult = await verifyCurrentUserPin(values.pin);
        if (!pinResult.success) {
            openAlert({ title: "PIN Incorrect", description: pinResult.error, variant: 'error' });
            setIsLoading(false);
            pinForm.reset();
            return;
        }
    
        const feeResult = await requestBankStatement({
            startDate: form.getValues('dateRange.from'),
            endDate: form.getValues('dateRange.to'),
            fee: STATEMENT_FEE,
        });
        
        if (!feeResult.success) {
             openAlert({ title: "Erreur de paiement", description: feeResult.error, variant: 'error' });
             setIsLoading(false);
             return;
        }
        
        if (user) {
            const statementTransactions = await getUserTransactions(user.id, 500, {
                from: form.getValues('dateRange.from'),
                to: form.getValues('dateRange.to'),
            });
            setTransactions(statementTransactions);
            setStep('statement');
        } else {
             openAlert({ title: "Erreur", description: "Utilisateur non trouvé.", variant: 'error' });
        }
        
        setIsLoading(false);
    };
    
    if (step === 'statement' && user) {
        const dateRange = form.getValues('dateRange');
        return <StatementDisplay transactions={transactions} fromDate={dateRange.from} toDate={dateRange.to} onBack={() => setStep('date')} user={user}/>
    }

    return (
        <>
            <Card className="w-full max-w-lg mx-auto">
                <CardHeader>
                    <CardTitle>Demander un relevé</CardTitle>
                    <CardDescription>Sélectionnez une période pour générer votre relevé de compte.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleDateSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="dateRange"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button type="button" id="date" variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {field.value?.from ? ( field.value.to ? (<>{format(field.value.from, "LLL dd, y")} - {format(field.value.to, "LLL dd, y")}</>) : (format(field.value.from, "LLL dd, y"))) : (<span>Choisissez une plage de dates</span>)}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar initialFocus mode="range" defaultMonth={field.value?.from} selected={{from: field.value.from, to: field.value.to}} onSelect={field.onChange} numberOfMonths={2} disabled={(date) => date > new Date() || date < new Date("2000-01-01")}/>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Alert>
                                <CardTitle className="text-sm">Frais de Service : ${STATEMENT_FEE.toFixed(2)}</CardTitle>
                            </Alert>
                            <Button type="submit" variant="gradient" className="w-full">
                                Continuer
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-center">Confirmer avec votre PIN</DialogTitle>
                        <DialogDescription className="text-center">Des frais de ${STATEMENT_FEE.toFixed(2)} seront appliqués.</DialogDescription>
                    </DialogHeader>
                     <Form {...pinForm}>
                        <form onSubmit={pinForm.handleSubmit(handlePinSubmit)} className="space-y-6 pt-4">
                            <FormField
                                control={pinForm.control}
                                name="pin"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="sr-only">Code PIN de sécurité</FormLabel>
                                    <FormControl>
                                        <div className="flex justify-center">
                                            <InputOTP maxLength={4} {...field}>
                                                <InputOTPGroup>
                                                    <InputOTPSlot index={0} />
                                                    <InputOTPSlot index={1} />
                                                    <InputOTPSlot index={2} />
                                                    <InputOTPSlot index={3} />
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}/>
                            <DialogFooter>
                                <Button type="submit" variant="gradient" className="w-full" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                    Confirmer et Générer
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}
