
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, User, Mail, FileText, Briefcase, Globe, ShieldCheck, Loader2, FlipHorizontal, CheckCircle, AlertCircle, Wallet } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import Webcam from 'react-webcam';
import { useToast } from '@/components/ui/use-toast';
import { registerNewAccount, checkAvailability, sendEmailOtp, verifyEmailOtp } from '@/lib/actions/signin.actions';
import { RegistrationCertificate } from './registration-certificate';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const translations = {
    fr: {
        title: "Identité Souveraine CashPay",
        description: "Finalisation de votre compte",
        takePicture: "Prendre une photo",
        uploadId: "Scan de la pièce d'identité (Recto)",
        upload: "Importer",
        capture: "Capturer",
        close: "Fermer",
        captureId: "Capturer la pièce d'identité",
        captureSignature: "Capturer la signature",
        signature: "Signature Autorisée",
        signHere: "Importez ou capturez une image de votre signature",
        clear: "Effacer",
        accountType: "Type de Compte",
        national: "National",
        diaspora: "Diaspora",
        business: "Business B2B",
        companyName: "Nom de l'entreprise",
        civilState: "État Civil",
        firstName: "Prénom",
        lastName: "Nom",
        gender: "Genre",
        male: "Homme",
        female: "Femme",
        maritalStatus: "État civil",
        single: "Célibataire",
        married: "Marié(e)",
        divorced: "Divorcé(e)",
        widowed: "Veuf/ve",
        birthDate: "Date de naissance",
        pickDate: "Choisir une date",
        birthPlace: "Lieu de naissance",
        contactResidence: "Contact & Résidence",
        email: "Email",
        invalidEmail: "Adresse email invalide.",
        verify: "Vérifier",
        emailVerified: "Email vérifié",
        emailVerifying: "Vérification...",
        emailAlreadyUsed: "Cet email est déjà utilisé.",
        otpSent: "Un OTP a été envoyé. Veuillez vérifier votre email.",
        otpInvalid: "Code invalide ou expiré.",
        verifyOtp: "Valider l'OTP",
        city: "Ville",
        address: "Adresse complète",
        identityProfession: "Identité & Profession",
        monthlyIncome: "Revenu mensuel (USD)",
        idType: "Type de pièce",
        idTypePassport: "Passeport",
        idTypeIdCard: "Carte d'identité",
        idTypeDriverLicense: "Permis de conduire",
        idNumber: "Numéro de pièce",
        idNumberExists: "Ce numéro de pièce existe déjà.",
        idNumberAvailable: "Numéro de pièce disponible.",
        profession: "Profession",
        nationality: "Nationalité",
        guarantor: "Garant (Contact d'urgence)",
        guarantorName: "Nom complet",
        guarantorPhone: "Téléphone",
        guarantorRelation: "Lien de parenté",
        relationParent: "Parent",
        relationSibling: "Frère / Sœur",
        relationSpouse: "Conjoint(e)",
        relationOther: "Autre",
        submit: "Créer un compte",
        submitting: "Création...",
        errorTitle: "Erreur",
        errorProfilePhoto: "Veuillez prendre une photo de profil.",
        errorIdScan: "Veuillez fournir une image de votre pièce d'identité.",
        errorSignature: "Veuillez fournir une image de votre signature.",
        errorEmailNotVerified: "Veuillez vérifier votre adresse email.",
        registrationFailed: "Échec de l'inscription",
        registrationFailedMessage: "Veuillez vérifier les informations et réessayer.",
        registrationSuccess: "Compte créé avec succès !",
        welcomeMessage: "Bienvenue ! Votre ID portefeuille est {id_wallet}",
    },
    en: {
        title: "CashPay Sovereign Identity",
        description: "Finalize your account",
        takePicture: "Take a picture",
        uploadId: "ID Scan (Front)",
        upload: "Upload",
        capture: "Capture",
        close: "Close",
        captureId: "Capture ID Document",
        captureSignature: "Capture Signature",
        signature: "Authorized Signature",
        signHere: "Upload or capture an image of your signature",
        clear: "Clear",
        accountType: "Account Type",
        national: "National",
        diaspora: "Diaspora",
        business: "Business B2B",
        companyName: "Company Name",
        civilState: "Civil Status",
        firstName: "First Name",
        lastName: "Last Name",
        gender: "Gender",
        male: "Male",
        female: "Female",
        maritalStatus: "Marital Status",
        single: "Single",
        married: "Married",
        divorced: "Divorced",
        widowed: "Widowed",
        birthDate: "Date of Birth",
        pickDate: "Pick a date",
        birthPlace: "Place of Birth",
        contactResidence: "Contact & Residence",
        email: "Email",
        invalidEmail: "Invalid email address.",
        verify: "Verify",
        emailVerified: "Email verified",
        emailVerifying: "Verifying...",
        emailAlreadyUsed: "This email is already in use.",
        otpSent: "An OTP has been sent. Please check your email.",
        otpInvalid: "Invalid or expired code.",
        verifyOtp: "Verify OTP",
        city: "City",
        address: "Full Address",
        identityProfession: "Identity & Profession",
        monthlyIncome: "Monthly Income (USD)",
        idType: "ID Type",
        idTypePassport: "Passport",
        idTypeIdCard: "ID Card",
        idTypeDriverLicense: "Driver's License",
        idNumber: "ID Number",
        idNumberExists: "This ID number already exists.",
        idNumberAvailable: "ID number is available.",
        profession: "Profession",
        nationality: "Nationality",
        guarantor: "Guarantor (Emergency Contact)",
        guarantorName: "Full Name",
        guarantorPhone: "Phone",
        guarantorRelation: "Relationship",
        relationParent: "Parent",
        relationSibling: "Sibling",
        relationSpouse: "Spouse",
        relationOther: "Other",
        submit: "Create account",
        submitting: "Creating...",
        errorTitle: "Error",
        errorProfilePhoto: "Please take a profile picture.",
        errorIdScan: "Please provide an image of your ID document.",
        errorSignature: "Please provide an image of your signature.",
        errorEmailNotVerified: "Please verify your email address.",
        registrationFailed: "Registration Failed",
        registrationFailedMessage: "Please check the information and try again.",
        registrationSuccess: "Account created successfully!",
        welcomeMessage: "Welcome! Your wallet ID is {id_wallet}",
    }
};

const useTranslation = (lang: string) => {
    const language = lang.startsWith('fr') ? 'fr' : 'en';
    return (key: keyof typeof translations['en'], options?: { [key: string]: string | number }) => {
        let text = translations[language][key] || key;
        if (options) {
            Object.keys(options).forEach(k => {
                text = text.replace(`{${k}}`, String(options[k]));
            });
        }
        return text;
    };
};

const formSchema = z.object({
    account_type: z.enum(['national', 'diaspora', 'business']),
    company_name: z.string().optional(),
    first_name: z.string().min(2, "Le prénom est requis."),
    last_name: z.string().min(2, "Le nom est requis."),
    middle_name: z.string().optional(),
    gender: z.enum(['male', 'female'], { required_error: "Le genre est requis." }),
    marital_status: z.enum(['single', 'married', 'divorced', 'widowed'], { required_error: "L'état civil est requis." }),
    birth_date: z.date({ required_error: "La date de naissance est requise." }),
    birth_place: z.string().min(2, "Le lieu de naissance est requis."),
    email: z.string().email("L'adresse email est invalide."),
    city: z.string().min(2, "La ville est requise."),
    address: z.string().min(5, "L'adresse est requise."),
    id_type: z.enum(['passport', 'national_id', 'driver_license'], { required_error: "Le type de pièce est requis." }),
    id_number: z.string().min(3, "Le numéro de pièce est requis."),
    profession: z.string().min(2, "La profession est requise."),
    nationality: z.string().min(2, "La nationalité est requise."),
    income_per_month: z.coerce.number({ required_error: "Le revenu est requis." }).min(0, "Le revenu doit être un nombre positif ou nul."),
    representative_name: z.string().min(2, "Le nom du garant est requis."),
    representative_contact: z.string().min(5, "Le contact du garant est requis."),
    representative_relation: z.enum(['parent', 'sibling', 'spouse', 'other'], { required_error: "Le lien de parenté est requis." }),
});

interface CompleteProfileFormProps {
    phone: string;
    countryCode: string;
    countryName: string;
    province: string;
    referralCode: string | null;
    lang: string;
}

export function CompleteProfileForm({ phone, countryCode, countryName, province, referralCode, lang: initialLang }: CompleteProfileFormProps) {
    const [currentLang, setCurrentLang] = React.useState(initialLang);
    const t = useTranslation(currentLang);
    const { toast } = useToast();
      const [registeredUser, setRegisteredUser] = React.useState<User | null>(null);
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [validationDialog, setValidationDialog] = React.useState<{ open: boolean; message: string }>({ open: false, message: '' });
    const [registrationSuccessDialog, setRegistrationSuccessDialog] = React.useState(false);
    const [pendingRegisteredUser, setPendingRegisteredUser] = React.useState<User | null>(null);

    const [profilePhoto, setProfilePhoto] = React.useState<string | null>(null);
    const [idFrontImage, setIdFrontImage] = React.useState<string | null>(null);
    const [signatureData, setSignatureData] = React.useState<string | null>(null);

    const [cameraModal, setCameraModal] = React.useState<{ open: boolean; target: 'profile' | 'id' | 'signature' | null }>({ open: false, target: null });
    const [facingMode, setFacingMode] = React.useState<'user' | 'environment'>('user');

    const [emailState, setEmailState] = React.useState<{ status: 'idle' | 'pending' | 'verifying_otp' | 'verified' | 'error', message: string }>({ status: 'idle', message: '' });
    const [idNumberState, setIdNumberState] = React.useState<{ status: 'idle' | 'pending' | 'verified' | 'error', message: string }>({ status: 'idle', message: '' });

    const webcamRef = React.useRef<Webcam>(null);
    const idInputRef = React.useRef<HTMLInputElement>(null);
    const signatureInputRef = React.useRef<HTMLInputElement>(null);
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            account_type: 'national',
            first_name: '',
            last_name: '',
            email: '',
            id_number: '',
            id_type: 'national_id',
            nationality: countryName.split(' ')[0] || '',
            profession: '',
            birth_place: '',
            city: '',
            address: '',
            income_per_month: undefined,
            representative_name: '',
            representative_contact: '',
            representative_relation: 'parent', 
        },
    });

    const accountType = form.watch('account_type');

    const openCamera = (target: 'profile' | 'id' | 'signature') => {
        setFacingMode(target === 'profile' ? 'user' : 'environment');
        setCameraModal({ open: true, target });
    };

    const handleCapture = React.useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc && cameraModal.target) {
            if (cameraModal.target === 'profile') setProfilePhoto(imageSrc);
            if (cameraModal.target === 'id') setIdFrontImage(imageSrc);
            if (cameraModal.target === 'signature') setSignatureData(imageSrc);
            setCameraModal({ open: false, target: null });
        }
    }, [webcamRef, cameraModal.target]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, setter: (data: string) => void) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setter(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleVerifyEmail = async () => {
        const email = form.getValues('email');
        if (!z.string().email().safeParse(email).success) {
            form.setError('email', { message: t('invalidEmail') });
            return;
        }
        setEmailState({ status: 'pending', message: '' });
        const availability = await checkAvailability('email', email);
        if (!availability.available) {
            setEmailState({ status: 'error', message: t('emailAlreadyUsed') });
            form.setError('email', { message: t('emailAlreadyUsed') });
            return;
        }
        const otpResult = await sendEmailOtp(email);
        if (otpResult.success) {
            setEmailState({ status: 'verifying_otp', message: t('otpSent') });
        } else {
            setEmailState({ status: 'error', message: otpResult.error || 'Failed to send OTP' });
        }
    };

    const handleOtpVerification = async (otp: string) => {
        const email = form.getValues('email');
        const result = await verifyEmailOtp(email, otp);
        if (result.success) {
            setEmailState({ status: 'verified', message: t('emailVerified') });
        } else {
            setEmailState({ status: 'verifying_otp', message: result.error || t('otpInvalid') });
            toast({ title: t('errorTitle'), description: result.error || t('otpInvalid'), variant: 'destructive' });
        }
    };
    
    const handleVerifyIdNumber = async () => {
        const idNumber = form.getValues('id_number');
        if (idNumber.length < 3) {
            form.setError('id_number', { message: 'Le numéro doit contenir au moins 3 caractères.'});
            return;
        }
        setIdNumberState({ status: 'pending', message: '' });
        const availability = await checkAvailability('id_number', idNumber);
        if (availability.available) {
            setIdNumberState({ status: 'verified', message: t('idNumberAvailable') });
        } else {
            setIdNumberState({ status: 'error', message: t('idNumberExists') });
            form.setError('id_number', { message: t('idNumberExists') });
        }
    };

    const onInvalid = (errors: any) => {
        const firstError = Object.entries(errors)[0] as [string, any] | undefined;
        const messages: Record<string, string> = {
            account_type: 'Veuillez sélectionner le type de compte.',
            company_name: 'Veuillez saisir le nom de l’entreprise.',
            first_name: 'Veuillez saisir le prénom.',
            last_name: 'Veuillez saisir le nom.',
            gender: 'Veuillez sélectionner le genre.',
            marital_status: 'Veuillez sélectionner l’état civil.',
            birth_date: 'Veuillez saisir la date de naissance.',
            birth_place: 'Veuillez saisir le lieu de naissance.',
            email: 'Veuillez saisir une adresse email valide.',
            city: 'Veuillez saisir la ville.',
            address: 'Veuillez saisir l’adresse complète.',
            id_type: 'Veuillez sélectionner le type de pièce.',
            id_number: 'Veuillez saisir le numéro de pièce.',
            profession: 'Veuillez saisir la profession.',
            nationality: 'Veuillez saisir la nationalité.',
            income_per_month: 'Veuillez saisir le revenu mensuel.',
            representative_name: 'Veuillez saisir le nom du garant.',
            representative_contact: 'Veuillez saisir le téléphone du garant.',
            representative_relation: 'Veuillez sélectionner le lien de parenté du garant.'
        };
        setValidationDialog({
            open: true,
            message: firstError ? (messages[firstError[0]] || firstError[1]?.message || 'Veuillez compléter les informations demandées.') : 'Veuillez compléter les informations demandées.'
        });
    };

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!profilePhoto) { setValidationDialog({ open: true, message: t('errorProfilePhoto') }); return; }
        if (!idFrontImage) { setValidationDialog({ open: true, message: t('errorIdScan') }); return; }
        if (!signatureData) { setValidationDialog({ open: true, message: t('errorSignature') }); return; }
        if (emailState.status !== 'verified') { setValidationDialog({ open: true, message: t('errorEmailNotVerified') }); return; }
        if (accountType === 'business' && !values.company_name) { form.setError('company_name', { message: 'Le nom de l\'entreprise est requis' }); setValidationDialog({ open: true, message: 'Veuillez saisir le nom de l’entreprise.' }); return; }
        
        setIsSubmitting(true);
        try {
              const registrationData = {
                  ...values,
                  phone,
                  country: countryName,
                  countryCode,
                  province,
                  referralCode,
                  language: currentLang,
                  birth_date: values.birth_date instanceof Date && Number.isFinite(values.birth_date.getTime()) ? format(values.birth_date, 'yyyy-MM-dd') : null,
                  profile_photo: profilePhoto,
                  id_front_image: idFrontImage,
                  signature_image: signatureData,
                  representative: {
                      name: values.representative_name,
                      contact: values.representative_contact,
                      relation: values.representative_relation,
                  },
              };

            const result = await registerNewAccount(registrationData);

              if (result.success && result.id_wallet) {
                  setPendingRegisteredUser(result.user || null);
                  setRegistrationSuccessDialog(true);
              } else {
                  throw new Error(result.error || t('registrationFailedMessage'));
              }

          } catch (error: any) {
              toast({ title: t('registrationFailed'), description: error.message || t('registrationFailedMessage'), variant: 'destructive' });
          } finally {
              setIsSubmitting(false);
          }
      }

        if (registeredUser) {
            return <RegistrationCertificate user={registeredUser} />;
        }

      return (
        <>
            <Card className="w-full max-w-5xl mx-auto bg-[#000E38] text-white shadow-2xl rounded-3xl border-0 relative">
                <div className="absolute top-4 right-4 z-10">
                    <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/20 p-1 text-xs font-medium">
                        <Button onClick={() => setCurrentLang('fr')} size="sm" className={cn("rounded-full h-6 px-3", currentLang === 'fr' ? 'bg-primary text-white' : 'bg-transparent text-white/70 hover:bg-white/10')}>FR</Button>
                        <Button onClick={() => setCurrentLang('en')} size="sm" className={cn("rounded-full h-6 px-3", currentLang === 'en' ? 'bg-primary text-white' : 'bg-transparent text-white/70 hover:bg-white/10')}>EN</Button>
                    </div>
                </div>

                <CardHeader className="text-center p-6 sm:p-10">
                    <CardTitle className="text-3xl sm:text-4xl font-black uppercase tracking-tight">{t('title')}</CardTitle>
                    <CardDescription className="text-white/60">{t('description')} • {countryName}</CardDescription>
                </CardHeader>
                <CardContent className="p-6 sm:p-10">
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-10">
                            
                            <div className="flex flex-col items-center space-y-6">
                                <div className="relative">
                                    <Avatar className="h-32 w-32 border-4 border-primary ring-4 ring-primary/5">
                                        <AvatarImage src={profilePhoto || ''} className="object-cover" />
                                        <AvatarFallback className="bg-zinc-100 text-zinc-400"><User className="h-12 w-12" /></AvatarFallback>
                                    </Avatar>
                                    <Button type="button" onClick={() => openCamera('profile')} className="absolute bottom-0 right-0 h-10 w-10 rounded-full p-0 shadow-lg border-2 border-white bg-primary text-white"><Camera className="h-5 w-5" /></Button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-l-4 border-primary pl-3">{t('accountType')}</h3>
                                <FormField control={form.control} name="account_type" render={({ field }) => (
                                    <FormItem><FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-white/5"><RadioGroupItem value="national" id="at-nat"/><Label htmlFor="at-nat" className="w-full">{t('national')}</Label></div>
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-white/5"><RadioGroupItem value="diaspora" id="at-dia"/><Label htmlFor="at-dia" className="w-full">{t('diaspora')}</Label></div>
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-white/5"><RadioGroupItem value="business" id="at-biz"/><Label htmlFor="at-biz" className="w-full">{t('business')}</Label></div>
                                        </RadioGroup>
                                    </FormControl></FormItem>
                                )}/>
                                {accountType === 'business' && (
                                    <FormField control={form.control} name="company_name" render={({ field }) => (
                                        <FormItem><FormLabel>{t('companyName')} *</FormLabel><FormControl><Input placeholder={t('companyName')} className="h-12 bg-white/5 border-white/10" {...field} /></FormControl><FormMessage/></FormItem>
                                    )}/>
                                )}
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-l-4 border-primary pl-3">{t('civilState')}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="first_name" render={({ field }) => ( <FormItem><FormLabel>{t('firstName')} *</FormLabel><FormControl><Input className="h-12 bg-white/5 border-white/10" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                                    <FormField control={form.control} name="last_name" render={({ field }) => ( <FormItem><FormLabel>{t('lastName')} *</FormLabel><FormControl><Input className="h-12 bg-white/5 border-white/10" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <FormField control={form.control} name="gender" render={({ field }) => (
                                        <FormItem><FormLabel>{t('gender')} *</FormLabel><FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 flex-1 bg-white/5"><RadioGroupItem value="male" id="g-m"/><Label htmlFor="g-m" className="w-full">{t('male')}</Label></div>
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 flex-1 bg-white/5"><RadioGroupItem value="female" id="g-f"/><Label htmlFor="g-f" className="w-full">{t('female')}</Label></div>
                                        </RadioGroup></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="marital_status" render={({ field }) => (
                                        <FormItem><FormLabel>{t('maritalStatus')} *</FormLabel><FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-2">
                                            <div className="flex items-center space-x-2 border rounded-lg p-2 bg-white/5"><RadioGroupItem value="single" id="ms-s"/><Label htmlFor="ms-s" className="text-xs w-full">{t('single')}</Label></div>
                                            <div className="flex items-center space-x-2 border rounded-lg p-2 bg-white/5"><RadioGroupItem value="married" id="ms-m"/><Label htmlFor="ms-m" className="text-xs w-full">{t('married')}</Label></div>
                                            <div className="flex items-center space-x-2 border rounded-lg p-2 bg-white/5"><RadioGroupItem value="divorced" id="ms-d"/><Label htmlFor="ms-d" className="text-xs w-full">{t('divorced')}</Label></div>
                                            <div className="flex items-center space-x-2 border rounded-lg p-2 bg-white/5"><RadioGroupItem value="widowed" id="ms-w"/><Label htmlFor="ms-w" className="text-xs w-full">{t('widowed')}</Label></div>
                                        </RadioGroup></FormControl><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="birth_date" render={({ field }) => (
  <FormItem>
    <FormLabel>{t('birthDate')} *</FormLabel>
    <FormControl>
      <Input
        type="date"
        className="h-12 bg-white/5 border-white/10"
        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
        onChange={(e) => {
          const value = e.target.value
          if (!value) { field.onChange(undefined); return; }
          const [year, month, day] = value.split('-').map(Number)
          field.onChange(new Date(year, month - 1, day))
        }}
        max={new Date().toISOString().split('T')[0]}
        min="1920-01-01"
      />
    </FormControl>
    <FormMessage />
  </FormItem>
)}/>
                                    <FormField control={form.control} name="birth_place" render={({ field }) => ( <FormItem><FormLabel>{t('birthPlace')} *</FormLabel><FormControl><Input className="h-12 bg-white/5 border-white/10" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-l-4 border-primary pl-3">{t('contactResidence')}</h3>
                                 <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('email')} *</FormLabel>
                                        <div className="flex items-center gap-2">
                                            <FormControl><div className="relative flex-grow">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/>
                                                <Input type="email" {...field} disabled={emailState.status === 'verified'} placeholder="votre@email.com" className="h-12 pl-10 bg-white/5 border-white/10" />
                                            </div></FormControl>
                                            {emailState.status !== 'verified' && (
                                                <Button type="button" onClick={handleVerifyEmail} disabled={emailState.status === 'pending' || emailState.status === 'verifying_otp'}>{emailState.status === 'pending' ? <Loader2 className="h-4 w-4 animate-spin"/> : t('verify')}</Button>
                                            )}
                                            {emailState.status === 'verified' && <CheckCircle className="text-green-500" />}
                                        </div>
                                        <FormMessage />
                                        {emailState.status === 'verifying_otp' && (
                                            <div className="space-y-2 p-4 bg-white/10 rounded-lg mt-2">
                                                <p className="text-sm text-center">{emailState.message}</p>
                                                <InputOTP maxLength={6} onComplete={handleOtpVerification}>
                                                    <div className="flex justify-center w-full"><InputOTPGroup>{[...Array(6)].map((_, i) => <InputOTPSlot key={i} index={i}/>)}</InputOTPGroup></div>
                                                </InputOTP>
                                            </div>
                                        )}
                                        {emailState.status === 'error' && <FormDescription className="text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="h-4 w-4"/> {emailState.message}</FormDescription>}
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>{t('city')} *</FormLabel><FormControl><Input className="h-12 bg-white/5 border-white/10" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                                    <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>{t('address')} *</FormLabel><FormControl><Input className="h-12 bg-white/5 border-white/10" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-l-4 border-primary pl-3">{t('identityProfession')}</h3>
                                <FormField control={form.control} name="id_type" render={({ field }) => (
                                    <FormItem><FormLabel>{t('idType')} *</FormLabel><FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-white/5"><RadioGroupItem value="national_id" id="id-card"/><Label htmlFor="id-card" className="w-full">{t('idTypeIdCard')}</Label></div>
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-white/5"><RadioGroupItem value="passport" id="id-passport"/><Label htmlFor="id-passport" className="w-full">{t('idTypePassport')}</Label></div>
                                            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-white/5"><RadioGroupItem value="driver_license" id="id-license"/><Label htmlFor="id-license" className="w-full">{t('idTypeDriverLicense')}</Label></div>
                                        </RadioGroup>
                                    </FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="id_number" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('idNumber')} *</FormLabel>
                                        <div className="flex items-center gap-2">
                                            <FormControl><div className="relative flex-grow">
                                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/>
                                                <Input {...field} disabled={idNumberState.status === 'verified'} className="h-12 pl-10 font-mono uppercase bg-white/5 border-white/10"/>
                                            </div></FormControl>
                                            {idNumberState.status !== 'verified' && <Button type="button" onClick={handleVerifyIdNumber} disabled={idNumberState.status === 'pending'}>{idNumberState.status === 'pending' ? <Loader2 className="h-4 w-4 animate-spin"/> : t('verify')}</Button>}
                                            {idNumberState.status === 'verified' && <CheckCircle className="text-green-500" />}
                                        </div>
                                        <FormMessage />
                                        {idNumberState.message && <FormDescription className={cn(idNumberState.status === 'error' && 'text-red-500', idNumberState.status === 'verified' && 'text-green-500', "flex items-center gap-1 mt-1")}>{idNumberState.status === 'error' ? <AlertCircle className="h-4 w-4"/> : <CheckCircle className="h-4 w-4"/>} {idNumberState.message}</FormDescription>}
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="profession" render={({ field }) => ( <FormItem><FormLabel>{t('profession')} *</FormLabel><FormControl><div className="relative"><Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/><Input className="h-12 pl-10 bg-white/5 border-white/10" {...field} /></div></FormControl><FormMessage/></FormItem> )}/>
                                    <FormField control={form.control} name="nationality" render={({ field }) => ( <FormItem><FormLabel>{t('nationality')} *</FormLabel><FormControl><div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/><Input className="h-12 pl-10 bg-white/5 border-white/10" {...field} /></div></FormControl><FormMessage/></FormItem> )}/>
                                </div>
                                 <FormField control={form.control} name="income_per_month" render={({ field }) => (
                                     <FormItem>
                                         <FormLabel>{t('monthlyIncome')} *</FormLabel>
                                         <FormControl><div className="relative">
                                             <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"/>
                                             <Input type="number" placeholder="500" className="h-12 pl-10 bg-white/5 border-white/10" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} value={field.value ?? ''} />
                                         </div></FormControl>
                                         <FormMessage/>
                                     </FormItem>
                                 )}/>
                                <div className="space-y-3 pt-6">
                                    <FormLabel>{t('uploadId')} *</FormLabel>
                                    <div className="h-48 rounded-xl border-2 border-dashed flex items-center justify-center bg-white/5 overflow-hidden">
                                        {idFrontImage ? <img src={idFrontImage} alt="ID Scan" className="h-full w-full object-contain" /> : <FileText className="h-10 w-10 text-zinc-400"/>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button type="button" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20" onClick={() => idInputRef.current?.click()}>{t('upload')}</Button>
                                        <Button type="button" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20" onClick={() => openCamera('id')}>{t('capture')}</Button>
                                    </div>
                                    <input type="file" ref={idInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setIdFrontImage)} />
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-l-4 border-primary pl-3">{t('signature')}</h3>
                                <div className="h-48 rounded-xl border-2 border-dashed flex items-center justify-center bg-white/5 overflow-hidden">
                                    {signatureData ? <img src={signatureData} alt="Signature" className="h-full w-full object-contain p-4" /> : <p className="text-zinc-400 text-sm font-semibold">{t('signHere')}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button type="button" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20" onClick={() => signatureInputRef.current?.click()}>{t('upload')}</Button>
                                    <Button type="button" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20" onClick={() => openCamera('signature')}>{t('capture')}</Button>
                                </div>
                                <input type="file" ref={signatureInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setSignatureData)} />
                                 {signatureData && <Button type="button" variant="ghost" size="sm" onClick={() => setSignatureData(null)} className="w-full text-red-500 hover:bg-red-500/10 hover:text-red-400">{t('clear')}</Button>}
                            </div>

                            <div className="space-y-6 p-6 bg-white/5 rounded-2xl border border-white/10">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">{t('guarantor')}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="representative_name" render={({ field }) => ( <FormItem><FormLabel>{t('guarantorName')} *</FormLabel><FormControl><Input className="bg-white/10 h-12 border-white/20" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                                    <FormField control={form.control} name="representative_contact" render={({ field }) => ( <FormItem><FormLabel>{t('guarantorPhone')} *</FormLabel><FormControl><Input className="bg-white/10 h-12 border-white/20" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                                </div>
                                <FormField control={form.control} name="representative_relation" render={({ field }) => (
                                    <FormItem><FormLabel>{t('guarantorRelation')} *</FormLabel><FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                                             <div className="flex items-center space-x-2 border rounded-lg p-2 bg-white/10"><RadioGroupItem value="parent" id="rel-p"/><Label htmlFor="rel-p" className="text-xs w-full">{t('relationParent')}</Label></div>
                                             <div className="flex items-center space-x-2 border rounded-lg p-2 bg-white/10"><RadioGroupItem value="sibling" id="rel-s"/><Label htmlFor="rel-s" className="text-xs w-full">{t('relationSibling')}</Label></div>
                                             <div className="flex items-center space-x-2 border rounded-lg p-2 bg-white/10"><RadioGroupItem value="spouse" id="rel-sp"/><Label htmlFor="rel-sp" className="text-xs w-full">{t('relationSpouse')}</Label></div>
                                             <div className="flex items-center space-x-2 border rounded-lg p-2 bg-white/10"><RadioGroupItem value="other" id="rel-o"/><Label htmlFor="rel-o" className="text-xs w-full">{t('relationOther')}</Label></div>
                                        </RadioGroup>
                                    </FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>

                            <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-bold shadow-xl rounded-xl" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5"/> : <ShieldCheck className="mr-2 h-5 w-5"/>}
                                {isSubmitting ? t('submitting') : t('submit')}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <AlertDialog open={validationDialog.open} onOpenChange={(open) => setValidationDialog(v => ({ ...v, open }))}>
                <AlertDialogContent className="bg-[#000E38] text-white border-primary">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('errorTitle')}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <p className="text-white/80 text-sm">{validationDialog.message}</p>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setValidationDialog(v => ({ ...v, open: false }))}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={registrationSuccessDialog} onOpenChange={setRegistrationSuccessDialog}>
                <AlertDialogContent className="bg-[#000E38] text-white border-primary">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('registrationSuccess')}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <p className="text-white/80 text-sm">{pendingRegisteredUser ? t('welcomeMessage', { id_wallet: pendingRegisteredUser.id_wallet || '' }) : t('registrationSuccess')}</p>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => {
                            setRegistrationSuccessDialog(false);
                            if (pendingRegisteredUser) setRegisteredUser(pendingRegisteredUser);
                        }}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={cameraModal.open} onOpenChange={(open) => !open && setCameraModal({open: false, target: null})}>
                <AlertDialogContent className="bg-black text-white border-primary">
                    <AlertDialogHeader><AlertDialogTitle>
                        {cameraModal.target === 'profile' && t('takePicture')}
                        {cameraModal.target === 'id' && t('captureId')}
                        {cameraModal.target === 'signature' && t('captureSignature')}
                    </AlertDialogTitle></AlertDialogHeader>
                    <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode }} className="w-full rounded-lg" />
                    <AlertDialogFooter className="sm:justify-between items-center mt-4">
                         <Button type="button" variant="ghost" className="hover:bg-white/10" onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')}><FlipHorizontal/></Button>
                         <div className="flex gap-4">
                            <AlertDialogCancel asChild><Button variant="outline" className="bg-transparent border-white/20 hover:bg-white/10">{t('close')}</Button></AlertDialogCancel>
  <AlertDialogAction onClick={handleCapture}>{t('capture')}</AlertDialogAction>
                         </div>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
