
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useRouter } from 'next/navigation';
import type { MonPaysCategory } from '@/lib/types';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { UploadCloud, Loader2 } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { createMonPaysCompany } from '@/lib/actions/monpays.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { Label } from '../ui/label';

const categories: MonPaysCategory[] = [
  'E-commerce', 'Finance numérique', 'Startups et fintech', 'Banques digitales',
  'Sites d’actualités', 'Hôtels', 'Écoles', 'Services publics', 
  'Transferts d’argent', 'Streaming', 'Entreprises locales'
];

const companyFormSchema = z.object({
  name: z.string().min(3, { message: "Le nom de l'entreprise est requis." }),
  category: z.string({ required_error: "Veuillez sélectionner une catégorie." }),
  country: z.string({ required_error: "Veuillez sélectionner le pays." }),
  website: z.string().url({ message: "Veuillez entrer une URL valide." }).optional().or(z.literal('')),
  address: z.string().min(10, { message: "L'adresse complète est requise." }),
  rccm: z.string().min(1, { message: "Le numéro RCCM est requis." }),
  nif: z.string().min(1, { message: "L'ID National / NIF est requis." }),
  phone: z.string().min(9, { message: "Le numéro de téléphone est requis." }),
  email: z.string().email({ message: "Veuillez entrer une adresse email valide." }),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  paymentCurrency: z.string({ required_error: 'Veuillez choisir une devise pour le paiement.' })
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

const FileUpload = ({ label, onFileSelect, preview }: { label: string, onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void, preview: string | null }) => {
    return (
        <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
                <label className="mt-2 flex justify-center items-center w-full h-32 px-4 transition bg-zinc-700/50 border-2 border-dashed border-zinc-600 rounded-md appearance-none cursor-pointer hover:border-red-500 focus:outline-none">
                    {preview ? (
                        <Image src={preview} alt={`${label} preview`} width={128} height={128} className="h-full w-auto object-contain" data-ai-hint="company logo" />
                    ) : (
                        <span className="flex items-center space-x-2 text-zinc-400">
                            <UploadCloud className="w-6 h-6" />
                            <span className="font-medium">Cliquer pour téléverser</span>
                        </span>
                    )}
                    <input type="file" className="sr-only" accept="image/*" onChange={onFileSelect} />
                </label>
            </FormControl>
            <FormMessage />
        </FormItem>
    );
};

export function CreateCompanyForm() {
    const { openAlert } = useAlertDialog();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);
    const [creationFee, setCreationFee] = useState<number | null>(null);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [submissionData, setSubmissionData] = useState<z.infer<typeof companyFormSchema> | null>(null);

    useEffect(() => {
        const fetchFee = async () => {
            const fee = await calculateTransactionFee(0, 'USD', 'MONPAYS_PAGE');
            setCreationFee(fee);
        };
        fetchFee();
    }, []);

    const form = useForm<z.infer<typeof companyFormSchema>>({
        resolver: zodResolver(companyFormSchema),
        defaultValues: {
            name: '',
            category: undefined,
            country: 'CD',
            website: '',
            address: '',
            rccm: '',
            nif: '',
            phone: '',
            email: '',
            paymentCurrency: 'USD'
        }
    });
    
     const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
        defaultValues: { pin: '' },
    });


    const handleFileChange = (
        event: React.ChangeEvent<HTMLInputElement>,
        setPreview: (value: string | null) => void,
        fieldName: 'logoUrl' | 'bannerUrl'
      ) => {
        const file = event.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            setPreview(dataUrl);
            form.setValue(fieldName, dataUrl, { shouldValidate: true });
          };
          reader.readAsDataURL(file);
        }
      };
    
    const onSubmit = (values: z.infer<typeof companyFormSchema>) => {
        setSubmissionData(values);
        setIsPinDialogOpen(true);
    };

    const handlePinConfirm = async (pinValues: z.infer<typeof pinSchema>) => {
        const user = await getAuthenticatedUser();
        if (!submissionData || !user) return;
        
        setIsSubmitting(true);
        const result = await createMonPaysCompany({
            user,
            pin: pinValues.pin,
            companyData: submissionData
        });
        setIsSubmitting(false);
        setIsPinDialogOpen(false);
        
        if (result.success) {
            openAlert({
                variant: 'success',
                title: 'Demande Soumise !',
                description: `Votre demande de création pour l'entreprise "${submissionData.name}" a été soumise. Elle est maintenant en attente de validation par notre équipe.`
            });
            router.push('/monpays/dashboard');
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
    };

    return (
        <>
            <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmer la Création</DialogTitle>
                        <DialogDescription>
                            Veuillez entrer votre PIN pour confirmer le paiement des frais de création de <strong>${creationFee?.toFixed(2)} {submissionData?.paymentCurrency}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...pinForm}>
                        <form onSubmit={pinForm.handleSubmit(handlePinConfirm)} className="space-y-4 pt-4">
                            <FormField control={pinForm.control} name="pin" render={({ field }) => ( <FormItem><FormLabel>Code PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage /></FormItem> )} />
                            <DialogFooter>
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Payer et Soumettre
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Nom de l'entreprise</FormLabel> <FormControl> <Input {...field} className="bg-zinc-700 border-zinc-600" /> </FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="category" render={({ field }) => ( <FormItem> <FormLabel>Catégorie</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl> <SelectTrigger className="bg-zinc-700 border-zinc-600"> <SelectValue placeholder="Sélectionnez un domaine d'activité" /> </SelectTrigger> </FormControl> <SelectContent className="bg-zinc-800 text-white border-zinc-700"> {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )}/>

                    <div className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem> <FormLabel>Téléphone</FormLabel> <FormControl> <Input type="tel" {...field} className="bg-zinc-700 border-zinc-600" /> </FormControl> <FormMessage /> </FormItem> )} />
                        <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Email</FormLabel> <FormControl> <Input type="email" {...field} className="bg-zinc-700 border-zinc-600" /> </FormControl> <FormMessage /> </FormItem> )} />
                    </div>
                    
                    <FormField control={form.control} name="website" render={({ field }) => ( <FormItem> <FormLabel>Site Web (Optionnel)</FormLabel> <FormControl> <Input {...field} className="bg-zinc-700 border-zinc-600" /> </FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="address" render={({ field }) => ( <FormItem> <FormLabel>Adresse Complète</FormLabel> <FormControl> <Input {...field} className="bg-zinc-700 border-zinc-600" /> </FormControl> <FormMessage /> </FormItem> )} />
                    
                    <div className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="rccm" render={({ field }) => ( <FormItem> <FormLabel>N° RCCM</FormLabel> <FormControl> <Input {...field} className="bg-zinc-700 border-zinc-600" /> </FormControl> <FormMessage /> </FormItem> )} />
                        <FormField control={form.control} name="nif" render={({ field }) => ( <FormItem> <FormLabel>ID. NAT / NIF</FormLabel> <FormControl> <Input {...field} className="bg-zinc-700 border-zinc-600" /> </FormControl> <FormMessage /> </FormItem> )} />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <FileUpload label="Logo de l'entreprise" preview={logoPreview} onFileSelect={(e) => handleFileChange(e, setLogoPreview, 'logoUrl')} />
                        <FileUpload label="Bannière de l'entreprise" preview={bannerPreview} onFileSelect={(e) => handleFileChange(e, setBannerPreview, 'bannerUrl')} />
                    </div>

                    <FormField control={form.control} name="paymentCurrency" render={({ field }) => ( <FormItem> <FormLabel>Payer les frais de création ({creationFee ? `$${creationFee.toFixed(2)}` : '...'}) avec</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl> <SelectTrigger className="bg-zinc-700 border-zinc-600"> <SelectValue /> </SelectTrigger> </FormControl> <SelectContent className="bg-zinc-800 text-white border-zinc-700"> <SelectItem value="USD">Portefeuille USD</SelectItem> <SelectItem value="CDF">Portefeuille CDF</SelectItem> <SelectItem value="EUR">Portefeuille EUR</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )}/>

                    <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Soumettre pour Vérification
                    </Button>
                </form>
            </Form>
        </>
    );
}
