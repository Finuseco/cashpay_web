

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from "react-i18next";
import Cookies from 'js-cookie';
import { debounce } from 'lodash';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CalendarIcon, Save, Camera, UploadCloud, PenSquare, Loader2, CheckCircle, XCircle, RefreshCcw, Info, ArrowLeft, ArrowRight, VideoOff } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Image from 'next/image';
import { registerUser, checkExistingUser } from "@/lib/actions/auth.actions";
import { Logo } from "@/components/logo";
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { generateProfilePhoto, validateProfilePhoto, validateSignature, extractIdInfo } from '@/lib/ai.actions';
import type { GenerateProfilePhotoInput, ValidateProfilePhotoOutput, ValidateSignatureOutput, ExtractIdInfoOutput } from '@/ai/flows/types';
import { RegistrationCertificate } from './registration-certificate';
import type { User } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '@/hooks/use-toast';


const formSchema = z.object({
  account_type: z.enum(['national', 'diaspora'], { required_error: "Le type de compte est requis." }),
  profile_photo: z.string().min(1, "La photo de profil est requise."),
  isAiGeneratedPhoto: z.boolean().default(false),
  signature_image: z.string().min(1, "La signature est requise."),
  first_name: z.string().min(2, "Le prénom est requis."),
  last_name: z.string().min(2, "Le nom est requis."),
  middle_name: z.string().optional(),
  gender: z.enum(['male', 'female', 'other'], { required_error: "Le genre est requis." }),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed'], { required_error: "Le statut marital est requis." }),
  birth_date: z.date({ required_error: "La date de naissance est requise." }),
  birth_place: z.string().min(2, "Le lieu de naissance est requis."),
  nationality: z.string().min(2, "La nationalité est requise."),
  email: z.string().email("Adresse email invalide.").optional().or(z.literal('')),
  city: z.string().min(2, "La ville est requise."),
  address: z.string().min(5, "L'adresse est requise."),
  profession: z.string().min(2, "La profession est requise."),
  activity_description: z.string().optional(),
  income_per_month: z.coerce.number().optional(),
  representative: z.object({
      name: z.string().min(3, "Le nom du contact est requis.").optional(),
      relation: z.string().min(3, "La relation est requise.").optional(),
      contact: z.string().min(9, "Le téléphone du contact est requis.").optional(),
  }).optional(),
  id_type: z.enum(['national_id', 'passport', 'driver_license', 'biometric_passport', 'diplomatic_passport', 'consular_card'], { required_error: "Le type de pièce d'identité est requis." }),
  id_number: z.string().min(5, "Le numéro de la pièce d'identité est requis."),
  id_issued_date: z.date({ required_error: "La date d'émission est requise." }),
  id_expiry_date: z.date({ required_error: "La date d'expiration est requise." }),
  id_front_image: z.string().min(1, "L'image recto de la pièce d'identité est requise."),
  id_back_image: z.string().optional(),
  country: z.string(),
  province: z.string().optional(),
});

type VerificationStatus = 'idle' | 'loading' | 'success' | 'error';
interface VerificationState {
    status: VerificationStatus;
    message: string | null;
}

const WebcamCapture = ({ onCapture, onOpenChange }: { onCapture: (dataUrl: string) => void; onOpenChange: (open: boolean) => void }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
    const { toast } = useToast();
    const { t } = useTranslation();

    React.useEffect(() => {
        const getCameraPermission = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
            } catch (error) {
                console.error('Error accessing camera:', error);
                setHasCameraPermission(false);
            }
        };
        getCameraPermission();
        
        return () => {
            // Cleanup: stop camera stream when component unmounts
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleCapture = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/png');
            onCapture(dataUrl);
            onOpenChange(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('webcamCaptureTitle')}</DialogTitle>
                <DialogDescription>{t('webcamCaptureDescription')}</DialogDescription>
            </DialogHeader>
            <div className="relative aspect-square w-full rounded-md overflow-hidden bg-zinc-900 border">
                 <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                 {hasCameraPermission === false && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/80">
                        <VideoOff className="h-12 w-12 mb-4" />
                        <p className="font-bold">{t('webcamAccessErrorTitle')}</p>
                        <p className="text-sm text-zinc-400">{t('webcamAccessErrorDescription')}</p>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancelButton')}</Button>
                <Button onClick={handleCapture} disabled={!hasCameraPermission}>
                    <Camera className="mr-2 h-4 w-4" />
                    {t('webcamCaptureButton')}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};


const VerificationStatusIndicator = ({ state }: { state: VerificationState }) => {
    if (state.status === 'idle') return null;
    return (
        <div className={cn('flex items-center gap-2 text-xs mt-2 transition-all', 
            state.status === 'success' && 'text-green-600',
            state.status === 'error' && 'text-destructive',
        )}>
            {state.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin"/>}
            {state.status === 'success' && <CheckCircle className="h-4 w-4"/>}
            {state.status === 'error' && <XCircle className="h-4 w-4"/>}
            <span className="font-medium">{state.message}</span>
        </div>
    );
};


const FileUpload = ({
  label,
  onFileSelect,
  preview,
  verificationState,
  onRetry,
  onCaptureClick,
}: {
  label: string;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  preview: string | null | undefined;
  verificationState: VerificationState;
  onRetry: () => void;
  onCaptureClick?: () => void;
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <>
            <input
                type="file"
                ref={inputRef}
                className="sr-only"
                accept="image/*"
                onChange={onFileSelect}
            />
            <div className={cn("relative flex justify-center items-center w-full h-32 px-4 transition bg-background border-2 border-dashed rounded-md appearance-none",
                verificationState.status === 'success' && 'border-green-500',
                verificationState.status === 'error' && 'border-destructive'
            )}>
                {preview ? (
                <Image
                    src={preview}
                    alt="Preview"
                    fill
                    className="object-contain rounded-md p-2"
                />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UploadCloud className="w-8 h-8" />
                        <span className="text-xs text-center">{t('fileUploadPrompt')}</span>
                    </div>
                )}
                 {verificationState.status === 'loading' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                        <Loader2 className="h-8 w-8 animate-spin text-white"/>
                    </div>
                )}
            </div>
        </>
      </FormControl>
       <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => inputRef.current?.click()}>
                <UploadCloud className="h-4 w-4 mr-2" />
                {t('uploadButton')}
            </Button>
            {onCaptureClick && (
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onCaptureClick}>
                    <Camera className="h-4 w-4 mr-2" />
                    {t('captureButton')}
                </Button>
            )}
        </div>
      <div className="flex items-center justify-between min-h-[20px]">
        <VerificationStatusIndicator state={verificationState} />
        {verificationState.status === 'error' && (
            <Button type="button" size="sm" variant="ghost" onClick={onRetry} className="text-xs h-auto p-1">
                <RefreshCcw className="h-3 w-3 mr-1"/>
                {t('retryButton')}
            </Button>
        )}
      </div>
       {verificationState.status === 'error' && (
            <Alert variant="destructive" className="mt-2 text-xs">
                 <Info className="h-4 w-4" />
                <AlertTitle>{t('verificationErrorTitle')}</AlertTitle>
                <AlertDescription dangerouslySetInnerHTML={{ __html: t('verificationErrorDescription') }} />
            </Alert>
        )}
      <FormMessage />
    </div>
  );
};

export function CompleteProfileForm() {
    const { openAlert } = useAlertDialog();
    const { t } = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const phone = searchParams.get("phone");
    const countryCode = searchParams.get("country");
    const countryName = searchParams.get("countryName");
    const province = searchParams.get("province");
    const referralCode = searchParams.get("ref");
  
    const [isSaving, setIsSaving] = React.useState(false);
    const [currentStep, setCurrentStep] = React.useState(0);
    const [completedSteps, setCompletedSteps] = React.useState<number[]>([]);
    
    const [photoVerification, setPhotoVerification] = React.useState<VerificationState>({ status: 'idle', message: null });
    const [signatureVerification, setSignatureVerification] = React.useState<VerificationState>({ status: 'idle', message: null });
    const [idVerification, setIdVerification] = React.useState<VerificationState>({ status: 'idle', message: null });
    
    const [idData, setIdData] = React.useState<{ fullName: string; idNumber: string} | null>(null);

    const [isWebcamOpen, setIsWebcamOpen] = React.useState(false);
  
    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      mode: 'onChange',
      defaultValues: {
        account_type: 'national',
        first_name: '',
        last_name: '',
        middle_name: '',
        birth_place: '',
        nationality: 'Congolaise (RDC)',
        email: '',
        city: '',
        address: '',
        profession: '',
        representative: { name: '', relation: '', contact: '' },
        id_number: '',
        country: countryName || '', // Use countryName for display
        province: province || '',
        profile_photo: '',
        isAiGeneratedPhoto: false,
        signature_image: '',
        id_front_image: '',
        id_back_image: '',
      },
    });
  
    const { watch, setError, clearErrors, trigger, setValue } = form;
    const firstName = watch('first_name');
    const lastName = watch('last_name');
    const idNumber = watch('id_number');
    const email = watch('email');
    const profilePhotoPreview = watch('profile_photo');
    const signaturePreview = watch('signature_image');
    const idFrontPreview = watch('id_front_image');
    
    const debouncedCheck = React.useCallback(
      debounce(async (value: string, field: 'email' | 'id_number') => {
        if (!value) return;
        const { exists } = await checkExistingUser(value);
        if (exists) {
          setError(field, { type: 'manual', message: t('valueExistsError') });
        } else {
          clearErrors(field);
        }
      }, 500),
      [setError, clearErrors, t]
    );
  
    React.useEffect(() => { if (email) debouncedCheck(email, 'email'); return () => debouncedCheck.cancel(); }, [email, debouncedCheck]);
    React.useEffect(() => { if (idNumber) debouncedCheck(idNumber, 'id_number'); return () => debouncedCheck.cancel(); }, [idNumber, debouncedCheck]);
  
    const nameMatches = React.useMemo(() => {
        if (!idData || !idData.fullName || !firstName || !lastName) return { match: true, message: null };
        
        const formNameParts = `${firstName} ${lastName}`.toLowerCase().split(' ').filter(Boolean);
        const aiNameParts = idData.fullName.toLowerCase().split(' ').filter(Boolean);
        
        const matches = formNameParts.filter(part => aiNameParts.includes(part));
        
        const match = matches.length >= 2;

        return {
            match,
            message: match ? t('namesMatchSuccess') : t('namesMatchError', { idName: idData.fullName })
        };
    }, [firstName, lastName, idData, t]);
  
    const idNumberMatches = React.useMemo(() => {
      if (!idData || !idData.idNumber || !idNumber) return { match: true, message: null };
      const match = idNumber.replace(/\s/g, '') === idData.idNumber.replace(/\s/g, '');
      return {
          match,
          message: match ? t('idNumberMatchSuccess') : t('idNumberMatchError', { idNumber: idData.idNumber })
      };
    }, [idNumber, idData, t]);
  
    const handleFileChange = React.useCallback(async ( event: React.ChangeEvent<HTMLInputElement>, fieldName: keyof z.infer<typeof formSchema>, verificationFunction?: (input: any) => Promise<any>, setVerificationState?: React.Dispatch<React.SetStateAction<VerificationState>>, dataKey?: 'photoDataUri' | 'signatureDataUri' | 'idCardDataUri' ) => {
        const file = event.target.files?.[0];
        if (file) {
          if(setVerificationState) setVerificationState({ status: 'loading', message: t('verificationInProgress') });
          const dataUrl = await new Promise<string>(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
          });
          form.setValue(fieldName, dataUrl, { shouldValidate: true });
          
          if (verificationFunction && setVerificationState && dataKey) {
              try {
                  const result = await verificationFunction({ [dataKey]: dataUrl });
                  let isValid = 'isValid' in result ? result.isValid : ('isDocumentValid' in result ? result.isDocumentValid : false);
                  let message = result.reason ?? (isValid ? t('verificationSuccess') : t('verificationFailed'));
                  if ('isDocumentValid' in result && !isValid) message = t('invalidIdDocumentError');
                  
                  setVerificationState({ status: isValid ? 'success' : 'error', message });
                  if (isValid && 'fullName' in result && 'idNumber' in result) {
                      setIdData({ fullName: result.fullName, idNumber: result.idNumber });
                  }
              } catch (e) {
                  console.error(e);
                  setVerificationState({ status: 'error', message: t('verificationAiError') });
              }
          }
        }
      }, [form, t]);

    const handleWebcamCapture = React.useCallback(async (dataUrl: string) => {
        setValue('profile_photo', dataUrl, { shouldValidate: true });
        setPhotoVerification({ status: 'loading', message: t('verificationInProgress') });
        try {
            const result = await validateProfilePhoto({ photoDataUri: dataUrl });
            setPhotoVerification({ status: result.isValid ? 'success' : 'error', message: result.reason });
        } catch (e) {
            console.error(e);
            setPhotoVerification({ status: 'error', message: t('verificationAiError') });
        }
    }, [setValue, setPhotoVerification, t]);
    
    const handleGeneratePhoto = async (gender: GenerateProfilePhotoInput['gender'], race: GenerateProfilePhotoInput['race']) => {
      setPhotoVerification({ status: 'loading', message: t('generatingAvatar') });
      try {
          const result = await generateProfilePhoto({ gender, race, nationality: form.getValues('nationality') || 'africaine' });
          if(result.photoDataUri) {
              form.setValue('profile_photo', result.photoDataUri);
              form.setValue('isAiGeneratedPhoto', true);
              setPhotoVerification({ status: 'success', message: t('avatarGeneratedWarning') });
          } else { throw new Error(t('avatarGenerationError')); }
      } catch (e: any) {
          console.error("Error generating AI photo:", e);
          setPhotoVerification({ status: 'error', message: e.message || t('avatarGenerationError') });
      }
    }
  
    const [finalUserData, setFinalUserData] = React.useState<User | null>(null);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!phone || !countryCode || !countryName) {
            openAlert({ variant: "error", title: t('error'), description: t('missingContactInfoError') });
            return;
        }
        setIsSaving(true);
        const result = await registerUser({ ...values, phone, country: countryName, countryCode, referralCode });
        setIsSaving(false);
        if (result.success && result.user) {
            Cookies.set('cashpay-token', result.token, { expires: 7, secure: true, sameSite: 'strict' });
            setFinalUserData(result.user);
            setCurrentStep(steps.length); // Go to final certificate step
        } else {
            openAlert({ variant: "error", title: t('registerFailTitle'), description: (result as any).error });
        }
    }
  
    const steps = [
      { name: t('stepIdentity'), fields: ['first_name', 'last_name', 'gender', 'marital_status', 'middle_name', 'account_type'], Component: Step1 },
      { name: t('stepContact'), fields: ['birth_date', 'birth_place', 'nationality', 'email', 'city', 'address'], Component: Step2 },
      { name: t('stepProfessional'), fields: ['profession', 'income_per_month', 'activity_description', 'representative.name', 'representative.relation', 'representative.contact'], Component: Step3 },
      { name: t('stepVerification'), fields: ['id_type', 'id_number', 'id_issued_date', 'id_expiry_date', 'profile_photo', 'signature_image', 'id_front_image'], Component: Step4 },
    ];

    const nextStep = async () => {
        const fields = steps[currentStep].fields as (keyof z.infer<typeof formSchema>)[];
        const output = await trigger(fields, { shouldFocus: true });
        if (!output) return;

        setCompletedSteps(prev => [...prev, currentStep]);
        setCurrentStep(prev => prev + 1);
    };

    const prevStep = () => setCurrentStep(prev => prev - 1);
    
    if (finalUserData) {
        return <RegistrationCertificate user={finalUserData} />;
    }

    const CurrentStepComponent = steps[currentStep]?.Component;
    const isLastFormStep = currentStep === steps.length - 1;
    const allVerificationsPassed = photoVerification.status === 'success' && signatureVerification.status === 'success' && idVerification.status === 'success' && nameMatches.match && idNumberMatches.match;

    return (
       <Form {...form}>
        <Dialog open={isWebcamOpen} onOpenChange={setIsWebcamOpen}>
            <WebcamCapture onCapture={handleWebcamCapture} onOpenChange={setIsWebcamOpen} />
        </Dialog>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="bg-card">
            <CardHeader className="items-center text-center">
                <Logo className="w-40 mb-4" />
                <CardTitle>{t('completeProfileTitle')}</CardTitle>
                 <div className="flex items-center gap-2 w-full max-w-sm pt-4">
                    {steps.map((step, index) => (
                        <React.Fragment key={step.name}>
                            <div className="flex flex-col items-center gap-1">
                                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center font-bold transition-colors", currentStep === index ? 'bg-primary text-primary-foreground' : completedSteps.includes(index) ? 'bg-green-500 text-white' : 'bg-muted')}>
                                    {completedSteps.includes(index) ? <CheckCircle className="h-5 w-5"/> : index + 1}
                                </div>
                                <p className="text-xs text-muted-foreground">{step.name}</p>
                            </div>
                            {index < steps.length - 1 && <div className={cn("flex-1 h-1 rounded-full transition-colors", currentStep > index ? 'bg-green-500' : 'bg-muted')} />}
                        </React.Fragment>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {CurrentStepComponent && <CurrentStepComponent
                            form={form}
                            phone={phone}
                            countryName={countryName}
                            province={province}
                            handleFileChange={handleFileChange}
                            handleGeneratePhoto={handleGeneratePhoto}
                            photoVerification={photoVerification}
                            signatureVerification={signatureVerification}
                            idVerification={idVerification}
                            idData={idData}
                            nameMatches={nameMatches}
                            idNumberMatches={idNumberMatches}
                            setPhotoVerification={setPhotoVerification}
                            setSignatureVerification={setSignatureVerification}
                            setIdVerification={setIdVerification}
                            setIdData={setIdData}
                            onCaptureClick={() => setIsWebcamOpen(true)}
                        />}
                    </motion.div>
                </AnimatePresence>
            </CardContent>
            <CardFooter className="flex-col gap-4">
                <div className="flex justify-between w-full">
                    <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> {t('backButton')}
                    </Button>
                    {isLastFormStep ? (
                        <Button type="submit" variant="gradient" disabled={isSaving || !allVerificationsPassed}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {t('completeProfileSubmitButton')}
                        </Button>
                    ) : (
                        <Button type="button" onClick={nextStep}>
                            {t('continueButton')} <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                </div>
                 <div className="text-center text-sm">
                    {t('registerHasAccount')}{" "}
                    <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                    {t('registerSignInLink')}
                    </Link>
                </div>
            </CardFooter>
          </Card>
        </form>
      </Form>
    );
  }

  // --- STEP COMPONENTS ---
  
const Step1 = ({ form }: { form: any }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <FormField control={form.control} name="account_type" render={({ field }) => ( <FormItem><FormLabel>{t('accountTypeLabel')}</FormLabel><FormControl> <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4"> <FormItem className="flex items-center space-x-2"><FormControl> <RadioGroupItem value="national" /> </FormControl> <FormLabel className="font-normal">{t('accountTypeNational')}</FormLabel> </FormItem> <FormItem className="flex items-center space-x-2"> <FormControl> <RadioGroupItem value="diaspora" /> </FormControl> <FormLabel className="font-normal">{t('accountTypeDiaspora')}</FormLabel> </FormItem> </RadioGroup> </FormControl><FormMessage /></FormItem> )} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="last_name" render={({ field }) => ( <FormItem><FormLabel>{t('lastNameLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="middle_name" render={({ field }) => ( <FormItem><FormLabel>{t('middleNameLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="first_name" render={({ field }) => ( <FormItem><FormLabel>{t('firstNameLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="gender" render={({ field }) => ( <FormItem><FormLabel>{t('genderLabel')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('selectPlaceholder')}/></SelectTrigger></FormControl><SelectContent><SelectItem value="male">{t('genderMale')}</SelectItem><SelectItem value="female">{t('genderFemale')}</SelectItem><SelectItem value="other">{t('genderOther')}</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="marital_status" render={({ field }) => ( <FormItem><FormLabel>{t('maritalStatusLabel')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('selectPlaceholder')}/></SelectTrigger></FormControl><SelectContent><SelectItem value="single">{t('maritalStatusSingle')}</SelectItem><SelectItem value="married">{t('maritalStatusMarried')}</SelectItem><SelectItem value="divorced">{t('maritalStatusDivorced')}</SelectItem><SelectItem value="widowed">{t('maritalStatusWidowed')}</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
            </div>
        </div>
    );
};

const Step2 = ({ form, phone, countryName, province }: { form: any, phone: string | null, countryName: string | null, province: string | null }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="birth_date" render={({ field }) => (<FormItem><FormLabel>{t('dobLabel')}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : <span>{t('chooseDate')}</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={1920} toYear={new Date().getFullYear()} /></PopoverContent></Popover><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="birth_place" render={({ field }) => ( <FormItem><FormLabel>{t('pobLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="nationality" render={({ field }) => ( <FormItem><FormLabel>{t('nationalityLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>{t('emailLabel')}</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormItem><FormLabel>{t('countryLabel')}</FormLabel><Input readOnly disabled value={countryName || ''} /></FormItem>
                <FormItem><FormLabel>{t('provinceLabel')}</FormLabel><Input readOnly disabled value={province || ''} /></FormItem>
                <FormItem><FormLabel>{t('phoneLabel')}</FormLabel><Input readOnly disabled value={phone || ''} /></FormItem>
            </div>
             <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>{t('cityLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
             <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>{t('addressLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
        </div>
    );
};

const Step3 = ({ form }: { form: any }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <FormField control={form.control} name="profession" render={({ field }) => ( <FormItem><FormLabel>{t('professionLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="activity_description" render={({ field }) => ( <FormItem><FormLabel>{t('activityDescriptionLabel')}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="income_per_month" render={({ field }) => ( <FormItem><FormLabel>{t('monthlyIncomeLabel')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <div>
                <h4 className="font-medium mb-2">{t('emergencyContactTitle')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField control={form.control} name="representative.name" render={({ field }) => ( <FormItem><FormLabel>{t('fullNameLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="representative.relation" render={({ field }) => ( <FormItem><FormLabel>{t('relationshipLabel')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('selectPlaceholder')} /></SelectTrigger></FormControl><SelectContent><SelectItem value="Famille">{t('relationshipFamily')}</SelectItem><SelectItem value="Ami">{t('relationshipFriend')}</SelectItem><SelectItem value="Conjoint">{t('relationshipSpouse')}</SelectItem><SelectItem value="Frère/Soeur">{t('relationshipSibling')}</SelectItem><SelectItem value="Parent">{t('relationshipParent')}</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="representative.contact" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>{t('phoneLabel')}</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                </div>
            </div>
        </div>
    );
};

const Step4 = ({ form, handleFileChange, handleGeneratePhoto, photoVerification, signatureVerification, idVerification, idData, nameMatches, idNumberMatches, setPhotoVerification, setSignatureVerification, setIdVerification, setIdData, onCaptureClick }: { form: any, handleFileChange: any, handleGeneratePhoto: any, photoVerification: VerificationState, signatureVerification: VerificationState, idVerification: VerificationState, idData: any, nameMatches: any, idNumberMatches: any, setPhotoVerification: any, setSignatureVerification: any, setIdVerification: any, setIdData: any, onCaptureClick: () => void }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                    <FormField control={form.control} name="profile_photo" render={({ field }) => ( <FileUpload label={t('profilePhotoLabel')} preview={form.getValues('profile_photo')} onFileSelect={(e) => handleFileChange(e, 'profile_photo', validateProfilePhoto, setPhotoVerification, 'photoDataUri')} verificationState={photoVerification} onRetry={() => form.getValues('profile_photo') && validateProfilePhoto({ photoDataUri: form.getValues('profile_photo') }).then((res: ValidateProfilePhotoOutput) => setPhotoVerification({ status: res.isValid ? 'success' : 'error', message: res.reason }))} onCaptureClick={onCaptureClick} /> )} />
                    {photoVerification.status === 'error' && ( <div className="mt-2 space-y-2 text-xs text-muted-foreground"><p>{t('aiPhotoAlternative')}</p><div className="flex gap-2"><Button type="button" size="sm" onClick={() => handleGeneratePhoto('homme', 'noir')}>{t('aiPhotoMale')}</Button><Button type="button" size="sm" onClick={() => handleGeneratePhoto('femme', 'noir')}>{t('aiPhotoFemale')}</Button></div></div> )}
                </div>
                <div>
                    <FormField control={form.control} name="signature_image" render={({ field }) => ( <FileUpload label={t('signatureLabel')} preview={form.getValues('signature_image')} onFileSelect={(e) => handleFileChange(e, 'signature_image', validateSignature, setSignatureVerification, 'signatureDataUri')} verificationState={signatureVerification} onRetry={() => form.getValues('signature_image') && validateSignature({ signatureDataUri: form.getValues('signature_image') }).then((res: ValidateSignatureOutput) => setSignatureVerification({ status: res.isValid ? 'success' : 'error', message: res.reason }))} /> )} />
                </div>
            </div>
            <Separator />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="id_type" render={({ field }) => ( <FormItem><FormLabel>{t('idTypeLabel')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('selectPlaceholder')}/></SelectTrigger></FormControl><SelectContent><SelectItem value="national_id">{t('idTypeNational')}</SelectItem><SelectItem value="passport">{t('idTypePassport')}</SelectItem><SelectItem value="driver_license">{t('idTypeDriverLicense')}</SelectItem><SelectItem value="biometric_passport">{t('idTypeBiometricPassport')}</SelectItem><SelectItem value="diplomatic_passport">{t('idTypeDiplomaticPassport')}</SelectItem><SelectItem value="consular_card">{t('idTypeConsularCard')}</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                 <FormField control={form.control} name="id_number" render={({ field }) => ( <FormItem><FormLabel>{t('idNumberLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                 <FormField control={form.control} name="id_issued_date" render={({ field }) => ( <FormItem><FormLabel>{t('issueDateLabel')}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : <span>{t('chooseDate')}</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={1920} toYear={new Date().getFullYear()} /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                 <FormField control={form.control} name="id_expiry_date" render={({ field }) => ( <FormItem><FormLabel>{t('expiryDateLabel')}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : <span>{t('chooseDate')}</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={new Date().getFullYear()} toYear={new Date().getFullYear() + 20}/></PopoverContent></Popover><FormMessage /></FormItem> )}/>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="id_front_image" render={({ field }) => ( <FileUpload label={t('idFrontLabel')} preview={form.getValues('id_front_image')} onFileSelect={(e) => handleFileChange(e, 'id_front_image', extractIdInfo, setIdVerification, 'idCardDataUri')} verificationState={idVerification} onRetry={() => form.getValues('id_front_image') && extractIdInfo({ idCardDataUri: form.getValues('id_front_image') }).then((res: ExtractIdInfoOutput) => { setIdVerification({ status: res.isDocumentValid ? 'success' : 'error', message: res.isDocumentValid ? t('validDocument') : t('invalidDocument') }); if (res.isDocumentValid) setIdData({ fullName: res.fullName, idNumber: res.idNumber }); })} /> )} />
                <FormField control={form.control} name="id_back_image" render={({ field }) => ( <FileUpload label={t('idBackLabel')} preview={form.getValues('id_back_image')} onFileSelect={(e) => handleFileChange(e, 'id_back_image')} verificationState={{status: 'idle', message: null}} onRetry={() => {}} /> )} />
            </div>
            {idData && ( <div className="space-y-1">
                <div className={cn("text-xs flex items-center gap-2", nameMatches.match ? 'text-green-600' : 'text-red-600')}> {nameMatches.match ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} {nameMatches.message} </div>
                <div className={cn("text-xs flex items-center gap-2", idNumberMatches.match ? 'text-green-600' : 'text-red-600')}> {idNumberMatches.match ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} {idNumberMatches.message} </div>
            </div>)}
        </div>
    );
};
