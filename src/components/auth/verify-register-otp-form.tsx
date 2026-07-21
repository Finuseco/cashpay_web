
'use client';

import { Suspense } from 'react';
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
} from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { verifyRegistrationOtp, sendRegistrationOtp } from "@/lib/actions/auth.actions";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import { Loader2 } from "lucide-react";
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { LanguageSwitcher } from '../ui/language-switcher';
import { Separator } from '../ui/separator';


const formSchema = z.object({
  otp: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

export function VerifyRegisterOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone");
  const country = searchParams.get("country");
  const countryName = searchParams.get("countryName");
  const province = searchParams.get("province");
  const referralCode = searchParams.get("ref");
  const language = searchParams.get("lang");
  const { t } = useTranslation();
  const { openAlert } = useAlertDialog();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      otp: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!phone || !country || !countryName) {
      openAlert({ variant: "error", title: "Erreur", description: "Phone number or country is missing from the request." });
      return;
    }
    
    setIsLoading(true);
    const result = await verifyRegistrationOtp(phone, values.otp);
    setIsLoading(false);

    if (!result.success) {
        openAlert({ variant: "error", title: "Verification Failed", description: result.error });
        return;
    }
    
    const destinationUrl = `/complete-profile?phone=${encodeURIComponent(phone)}&country=${encodeURIComponent(country)}&countryName=${encodeURIComponent(countryName)}${province ? `&province=${encodeURIComponent(province)}` : ''}${referralCode ? `&ref=${referralCode}` : ''}&lang=${language}`;
    router.push(destinationUrl);
  }
  
  const handleResendOtp = async () => {
    if (!phone) return;
    setIsResending(true);
    const result = await sendRegistrationOtp(phone);
    setIsResending(false);

    if (!result.success) {
      openAlert({
        variant: "error",
        title: "Échec de l'envoi",
        description: result.error
      });
      return;
    }

    openAlert({
      variant: "success",
      title: "Code Renvoyé",
      description: "Un nouveau code de vérification a été envoyé à votre téléphone."
    });
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <Logo className="w-40 mb-4" />
        <CardTitle className="text-2xl">{t('verifyRegisterOtpTitle')}</CardTitle>
        <CardDescription>
          {t('verifyRegisterOtpDescription')}
        </CardDescription>
        {phone && <p className="text-sm text-muted-foreground pt-2">{t('verifyRegisterOtpPhoneLabel')} {phone}</p>}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="otp"
              render={({ field }) => (
                 <FormItem>
                  <FormLabel>{t('otpFormOtpLabel')}</FormLabel>
                  <FormControl>
                    <div className="flex justify-center">
                        <InputOTP maxLength={6} {...field}>
                            <InputOTPGroup>
                                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                                <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('otpFormSubmitButton')}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center">
            <Button variant="link" onClick={handleResendOtp} disabled={isResending}>
                {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('resendCodeButton')}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
