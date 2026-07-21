
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { LogOut, Loader2, ShieldCheck, AlertTriangle, MessageCircle, Phone as PhoneIcon } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { User as UserType } from "@/lib/types";
import { Logo } from "../logo";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { verifyPinAndCreateSession, logout, verifyAgentPin, sendOtp, resetPinWithOtp } from "@/lib/actions/auth.actions";
import { Skeleton } from "../ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import Link from 'next/link';

const formSchema = z.object({
  pin: z.string().min(4, "PIN must be 4 digits.").max(4, "PIN must be 4 digits."),
});

const otpSchema = z.object({
  otp: z.string().min(6, "Le code OTP doit contenir 6 chiffres."),
});

const resetPinSchema = z.object({
    newPin: z.string().length(4, "Le nouveau PIN doit contenir 4 chiffres."),
    confirmPin: z.string().length(4, "La confirmation doit contenir 4 chiffres."),
}).refine(data => data.newPin === data.confirmPin, {
    message: "Les codes PIN ne correspondent pas.",
    path: ["confirmPin"],
});


interface PinLockFormProps {
    user: UserType;
    isAgentFlow?: boolean;
    onSuccess?: () => void;
    portalLogo?: React.ReactNode;
}

export function PinLockForm({ user, isAgentFlow = false, onSuccess, portalLogo }: PinLockFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);
  const [isResetPinDialogOpen, setIsResetPinDialogOpen] = useState(false);
  const [otpDestination, setOtpDestination] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  useEffect(() => {
      setIsClient(true);
  }, []);
  
  const firstName = user?.first_name || "User";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { pin: "" },
  });
  
  const otpForm = useForm<z.infer<typeof otpSchema>>({ resolver: zodResolver(otpSchema) });
  const resetPinForm = useForm<z.infer<typeof resetPinSchema>>({ resolver: zodResolver(resetPinSchema) });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      openAlert({ variant: "error", title: "Erreur", description: "Données utilisateur non trouvées." });
      return;
    }
    
    setIsLoading(true);

    const result = isAgentFlow && user.phone
        ? await verifyAgentPin(user.phone, values.pin)
        : await verifyPinAndCreateSession(user.id, values.pin);
    
    if (result.success) {
        if (typeof window !== "undefined") {
            sessionStorage.setItem('pin-verified-session', 'true');
        }
        if (onSuccess) {
            onSuccess();
        } else {
            if (result.user) {
                localStorage.setItem('cashpay-user-profile', JSON.stringify(result.user));
            }
            const returnTo = searchParams.get('returnTo');
            router.push(returnTo || (isAgentFlow ? "/agent/dashboard" : "/dashboard"));
        }
    } else {
      openAlert({
          variant: "error",
          title: t('pinLockErrorTitle'),
          description: result.success === false ? result.error : "Le code PIN que vous avez entré est incorrect.",
      });
      form.reset();
    }
    setIsLoading(false);
  }

  async function handleLogout() {
      await logout();
      router.push(isAgentFlow ? '/agent/login' : '/login');
  }

  const handleForgotPassword = async () => {
      if (!user) return;
      setIsSendingOtp(true);
      const result = await sendOtp(user.id, 'sms');
      setIsSendingOtp(false);

      if (result.success) {
          setOtpDestination(result.destination);
          setIsOtpDialogOpen(true);
      } else {
          openAlert({ title: 'Erreur', description: 'Impossible d\'envoyer le code de réinitialisation.', variant: 'error'});
      }
  };

  const handleOtpSubmit = async (values: z.infer<typeof otpSchema>) => {
      setIsLoading(true);
      setIsOtpDialogOpen(false);
      setIsResetPinDialogOpen(true);
      setIsLoading(false);
  };
  
  const handleResetPinSubmit = async (values: z.infer<typeof resetPinSchema>) => {
      if (!user) return;
      setIsLoading(true);

      const otp = otpForm.getValues('otp');
      const result = await resetPinWithOtp(user.id, otp, values.newPin);
      
      setIsLoading(false);
      if(result.success) {
          setIsResetPinDialogOpen(false);
          openAlert({ title: 'Succès', description: 'Votre PIN a été réinitialisé. Veuillez vous reconnecter.', variant: 'success' });
          form.reset();
          otpForm.reset();
          resetPinForm.reset();
      } else {
          openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
      }
  };

  if (user.status === 'Suspended') {
      return (
        <Card className="bg-card/80 backdrop-blur-sm border-red-500/50 shadow-2xl">
            <CardHeader className="items-center text-center">
                <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <CardTitle className="text-2xl text-red-600">Compte Suspendu</CardTitle>
                <CardDescription className="font-semibold text-foreground">
                    L'accès à votre compte a été restreint par une autorité CashPay.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertTitle className="font-bold">Motif de l'intervention :</AlertTitle>
                    <AlertDescription className="text-sm leading-relaxed">
                        {user.suspension_reason || "Violation des conditions d'utilisation ou dossier KYC incomplet."}
                    </AlertDescription>
                </Alert>
                
                <div className="space-y-3">
                    <p className="text-xs text-center text-muted-foreground">Veuillez contacter le support pour régulariser votre situation :</p>
                    <div className="grid grid-cols-2 gap-2">
                        <Button asChild variant="outline" className="h-12">
                            <Link href="/feedback">
                                <MessageCircle className="mr-2 h-4 w-4" /> Nous écrire
                            </Link>
                        </Button>
                        <Button variant="outline" className="h-12" onClick={() => window.location.href = 'tel:+243853868021'}>
                            <PhoneIcon className="mr-2 h-4 w-4" /> Appeler
                        </Button>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="ghost" className="w-full" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> Retour à l'accueil
                </Button>
            </CardFooter>
        </Card>
      );
  }


  return (
    <>
    <Dialog open={isOtpDialogOpen} onOpenChange={setIsOtpDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Vérification OTP</DialogTitle>
                <DialogDescription>Un code a été envoyé à {otpDestination}. Veuillez le saisir ci-dessous.</DialogDescription>
            </DialogHeader>
            <Form {...otpForm}>
                 <form onSubmit={otpForm.handleSubmit(handleOtpSubmit)} className="space-y-6 pt-4">
                    <FormField control={otpForm.control} name="otp" render={({ field }) => (<FormItem><FormLabel>Code OTP</FormLabel><FormControl><InputOTP maxLength={6} {...field} containerClassName="justify-center"><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/><InputOTPSlot index={4}/><InputOTPSlot index={5}/></InputOTPGroup></InputOTP></FormControl><FormMessage/></FormItem>)}/>
                    <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="animate-spin mr-2"/>}Vérifier</Button>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    
    <Dialog open={isResetPinDialogOpen} onOpenChange={setIsResetPinDialogOpen}>
         <DialogContent>
            <DialogHeader>
                <DialogTitle>Réinitialiser votre PIN</DialogTitle>
                <DialogDescription>Choisissez un nouveau PIN à 4 chiffres.</DialogDescription>
            </DialogHeader>
            <Form {...resetPinForm}>
                 <form onSubmit={resetPinForm.handleSubmit(handleResetPinSubmit)} className="space-y-6 pt-4">
                    <FormField control={resetPinForm.control} name="newPin" render={({ field }) => (<FormItem><FormLabel>Nouveau PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/>
                    <FormField control={resetPinForm.control} name="confirmPin" render={({ field }) => (<FormItem><FormLabel>Confirmer le nouveau PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/>
                    <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="animate-spin mr-2"/>}Enregistrer le nouveau PIN</Button>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        {portalLogo || <Logo className="w-40 mb-4" />}
        <Avatar className="h-20 w-20 border-2 border-primary my-4">
            <AvatarImage src={user.profile_photo || undefined} alt={user.full_name} />
            <AvatarFallback>
                {user.first_name?.[0]}{user.last_name?.[0]}
            </AvatarFallback>
        </Avatar>
        <CardTitle className="text-2xl">{isClient ? t('pinLockWelcomeBack', { name: firstName }) : `Welcome back, ${firstName}`}</CardTitle>
        <CardDescription>{isClient ? t('pinLockDescription') : 'Enter your PIN to unlock the application.'}</CardDescription>
      </CardHeader>
      <CardContent>
        {!isClient ? <Skeleton className="h-32 w-full"/> : (
            <>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>{isClient ? t('pinLockPinLabel') : 'PIN Code'}</FormLabel>
                    <FormControl>
                            <div className="flex justify-center">
                                <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>
                            </div>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isClient ? t('pinLockSubmitButton') : 'Unlock'}
                </Button>
            </form>
            </Form>
            <div className="mt-4 text-center text-sm">
                 <Button variant="link" onClick={handleForgotPassword} disabled={isSendingOtp} className="text-xs text-muted-foreground">
                    {isSendingOtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Envoi en cours...</> : 'PIN oublié ?'}
                </Button>
            </div>
            <div className="mt-6 text-center text-sm">
            <Button variant="link" onClick={handleLogout} className="font-semibold text-muted-foreground hover:text-primary">
                    <LogOut className="mr-2 h-4 w-4" />
                    {isClient ? t('pinLockNotYou') : 'Not you? Log out'}
                </Button>
            </div>
            </>
        )}
      </CardContent>
    </Card>
    </>
  );
}
