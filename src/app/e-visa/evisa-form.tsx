'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { cn } from '@/lib/utils';
import { saveBase64Image } from '@/lib/actions/helpers';
import { submitEvisaApplication, getVisaTypesForCountry } from '@/lib/actions/evisa.actions';
import type { EvisaApplicationData } from '@/lib/actions/evisa.actions';
import type { User } from '@/lib/types';
import { CalendarIcon, User as UserIcon, FileText as Passport, UploadCloud, ArrowLeft, Send, CheckCircle, Loader2, ShieldCheck, Banknote } from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogClose } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const VISA_FEE = 15; // Example visa fee
const SERVICE_FEE = 5; // Example service fee

const formSchema = z.object({
  destinationCountry: z.string({ required_error: "Veuillez sélectionner un pays." }),
  visaType: z.string({ required_error: "Veuillez sélectionner un type de visa." }),
  firstName: z.string().min(2, "Le prénom est requis."),
  lastName: z.string().min(2, "Le nom est requis."),
  dateOfBirth: z.date({ required_error: "La date de naissance est requise."}),
  passportNumber: z.string().min(5, "Le numéro de passeport est requis."),
  passportIssueDate: z.date({ required_error: "La date de délivrance est requise." }),
  passportExpiryDate: z.date({ required_error: "La date d'expiration est requise." }),
  passportPhotoUrl: z.string().min(1, "La photo d'identité est requise."),
  passportScanUrl: z.string().min(1, "Le scan du passeport est requis."),
  pin: z.string().length(4, "Le PIN de sécurité est requis."),
});

type Step = 'destination' | 'personal' | 'documents' | 'confirmation';

const FileUpload = ({ label, onFileSelect, preview }: { label: string, onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void, preview: string | null }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    return (
        <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
                <label className="mt-2 flex justify-center items-center w-full h-40 px-4 transition bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-md appearance-none cursor-pointer hover:border-primary">
                    {preview ? (
                        <Image src={preview} alt={`${label} preview`} width={160} height={160} className="h-full w-auto object-contain" />
                    ) : (
                        <span className="flex items-center space-x-2 text-muted-foreground">
                            <UploadCloud className="w-6 h-6" />
                            <span className="font-medium">Cliquer pour téléverser</span>
                        </span>
                    )}
                    <input type="file" ref={inputRef} className="sr-only" accept="image/*" onChange={onFileSelect} />
                </label>
            </FormControl>
            <FormMessage />
        </FormItem>
    );
};

export function EvisaForm({ user, countries }: { user: User, countries: { code: string; name: string }[] }) {
    const [step, setStep] = useState<Step>('destination');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            dateOfBirth: user.birth_date ? new Date(user.birth_date) : undefined,
            pin: '',
        },
    });
    
    const watchAllFields = form.watch();

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
        fieldName: 'passportPhotoUrl' | 'passportScanUrl'
    ) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                form.setValue(fieldName, dataUrl, { shouldValidate: true });
            };
            reader.readAsDataURL(file);
        }
    };

    const nextStep = () => {
        const stepFields: Record<Step, (keyof z.infer<typeof formSchema>)[]> = {
            destination: ['destinationCountry', 'visaType'],
            personal: ['firstName', 'lastName', 'dateOfBirth', 'passportNumber', 'passportIssueDate', 'passportExpiryDate'],
            documents: ['passportPhotoUrl', 'passportScanUrl'],
            confirmation: [],
        };
        form.trigger(stepFields[step]).then(isValid => {
            if (isValid) {
                const stepsOrder: Step[] = ['destination', 'personal', 'documents', 'confirmation'];
                const nextIndex = stepsOrder.indexOf(step) + 1;
                if (nextIndex < stepsOrder.length) {
                    setStep(stepsOrder[nextIndex]);
                }
            }
        });
    };

    const prevStep = () => {
        const stepsOrder: Step[] = ['destination', 'personal', 'documents', 'confirmation'];
        const prevIndex = stepsOrder.indexOf(step) - 1;
        if (prevIndex >= 0) {
            setStep(stepsOrder[prevIndex]);
        }
    };
    
    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);
        try {
            const photoUrl = await saveBase64Image(values.passportPhotoUrl, 'evisa_docs', `${user.id}_photo`);
            const scanUrl = await saveBase64Image(values.passportScanUrl, 'evisa_docs', `${user.id}_passport`);

            if (!photoUrl || !scanUrl) {
                throw new Error("Échec du téléversement des documents.");
            }
            
            const applicationData: EvisaApplicationData = {
                ...values,
                dateOfBirth: format(values.dateOfBirth, 'yyyy-MM-dd'),
                passportIssueDate: format(values.passportIssueDate, 'yyyy-MM-dd'),
                passportExpiryDate: format(values.passportExpiryDate, 'yyyy-MM-dd'),
                passportPhotoUrl: photoUrl,
                passportScanUrl: scanUrl,
            };
            
            const result = await submitEvisaApplication({
                user: user,
                applicationData: applicationData,
                totalFee: VISA_FEE + SERVICE_FEE,
                pin: values.pin
            });

            if (result.success) {
                openAlert({
                    variant: 'success', title: "Demande Envoyée",
                    description: `Votre demande d'e-visa a bien été soumise avec la référence ${result.applicationId}. Vous serez notifié de son statut.`
                });
                form.reset();
                setStep('destination');
            } else {
                openAlert({ variant: 'error', title: "Erreur", description: result.error || "Une erreur est survenue." });
            }

        } catch (error: any) {
            openAlert({ variant: 'error', title: "Erreur Critique", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const renderStep = () => {
        switch(step) {
            case 'destination': return <StepDestination countries={countries} form={form} />;
            case 'personal': return <StepPersonal />;
            case 'documents': return <StepDocuments handleFileChange={handleFileChange} />;
            case 'confirmation': return <StepConfirmation values={watchAllFields} />;
            default: return null;
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Demande d'E-Visa</CardTitle>
                    <CardDescription>Remplissez les informations pour votre demande de visa électronique.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={step}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    {renderStep()}
                                </motion.div>
                            </AnimatePresence>
                             <div className="flex justify-between items-center pt-6 border-t">
                                <Button type="button" variant="ghost" onClick={prevStep} disabled={step === 'destination'}>
                                    <ArrowLeft className="mr-2 h-4 w-4"/> Précédent
                                </Button>
                                {step === 'confirmation' ? (
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                        Confirmer et Payer
                                    </Button>
                                ) : (
                                    <Button type="button" onClick={nextStep}>
                                        Suivant
                                    </Button>
                                )}
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

// Step components
const StepDestination = ({ countries, form }: { countries: { code: string; name: string }[], form: any }) => {
    const { control, watch } = useFormContext();
    const destinationCountry = watch('destinationCountry');
    const [visaTypes, setVisaTypes] = useState<{ id: string; name: string }[]>([]);
    const [isLoadingTypes, setIsLoadingTypes] = useState(false);

    useEffect(() => {
        if (destinationCountry) {
            setIsLoadingTypes(true);
            getVisaTypesForCountry(destinationCountry).then((types: { id: string; name: string }[]) => {
                setVisaTypes(types);
                setIsLoadingTypes(false);
                form.setValue('visaType', ''); // Reset visa type when country changes
            });
        } else {
            setVisaTypes([]);
        }
    }, [destinationCountry, form]);

    return (
        <div className="space-y-6">
             <FormField control={control} name="destinationCountry" render={({ field }) => ( <FormItem><FormLabel>Pays de Destination</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez un pays"/></SelectTrigger></FormControl><SelectContent>{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem> )}/>
            <FormField control={control} name="visaType" render={({ field }) => ( <FormItem><FormLabel>Type de Visa</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoadingTypes || !destinationCountry}>
                <FormControl>
                    <SelectTrigger className="relative">
                        {isLoadingTypes && <Loader2 className="absolute right-8 h-4 w-4 animate-spin"/>}
                        <SelectValue placeholder={isLoadingTypes ? "Chargement des types..." : "Sélectionnez un type de visa"}/>
                    </SelectTrigger>
                </FormControl>
                <SelectContent>
                    {visaTypes.map(vt => <SelectItem key={vt.id} value={vt.id}>{vt.name}</SelectItem>)}
                </SelectContent>
            </Select><FormMessage/></FormItem> )}/>
        </div>
    );
}

const StepPersonal = () => {
    const { control } = useFormContext();
    return (
         <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>Prénom(s)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem> )}/>
                <FormField control={control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Nom de famille</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem> )}/>
            </div>
            <FormField control={control} name="dateOfBirth" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date de naissance</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : <span>Choisir une date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={1920} toYear={new Date().getFullYear()} /></PopoverContent></Popover><FormMessage/></FormItem>)}/>
            <Separator />
             <FormField control={control} name="passportNumber" render={({ field }) => ( <FormItem><FormLabel>Numéro de Passeport</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem> )}/>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={control} name="passportIssueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date de délivrance</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : <span>Choisir une date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent></Popover><FormMessage/></FormItem> )}/>
                 <FormField control={control} name="passportExpiryDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date d'expiration</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : <span>Choisir une date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent></Popover><FormMessage/></FormItem> )}/>
             </div>
        </div>
    )
}

const StepDocuments = ({ handleFileChange }: { handleFileChange: any }) => {
    const { watch } = useFormContext();
    const photoPreview = watch('passportPhotoUrl');
    const scanPreview = watch('passportScanUrl');

    return (
        <div className="space-y-6">
            <FileUpload label="Photo d'identité (format passeport)" preview={photoPreview} onFileSelect={(e) => handleFileChange(e, 'passportPhotoUrl')} />
            <FileUpload label="Scan de la page d'identité du passeport" preview={scanPreview} onFileSelect={(e) => handleFileChange(e, 'passportScanUrl')} />
        </div>
    );
};

const StepConfirmation = ({ values }: { values: Partial<z.infer<typeof formSchema>> }) => {
    const { control } = useFormContext();
    const totalFee = VISA_FEE + SERVICE_FEE;

    return (
        <div className="space-y-4">
            <h3 className="font-bold">Veuillez vérifier vos informations</h3>
            <div className="p-4 border rounded-lg space-y-2 text-sm bg-muted/50">
                <p><strong>Pays :</strong> {values.destinationCountry}</p>
                <p><strong>Type de visa :</strong> {values.visaType}</p>
                <p><strong>Nom complet :</strong> {values.firstName} {values.lastName}</p>
                <p><strong>Date de naissance :</strong> {values.dateOfBirth ? format(values.dateOfBirth, 'dd MMMM yyyy', {locale: fr}) : 'N/A'}</p>
                <p><strong>N° Passeport :</strong> {values.passportNumber}</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Banknote/>Résumé des frais</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                    <div className="flex justify-between"><span>Frais de visa :</span><span>${VISA_FEE.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Frais de service :</span><span>${SERVICE_FEE.toFixed(2)}</span></div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between font-bold text-base"><span>Total à payer :</span><span>${totalFee.toFixed(2)}</span></div>
                </CardContent>
            </Card>
            <FormField
              control={control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PIN de sécurité pour confirmer</FormLabel>
                  <FormControl>
                    <div className="flex justify-center">
                        <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
    );
};
