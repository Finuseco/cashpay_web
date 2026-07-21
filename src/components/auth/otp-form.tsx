
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
} from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { verifyOtp, sendOtp } from "@/lib/actions/auth.actions";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import Cookies from "js-cookie";
import { Loader2 } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import type { User } from "@/lib/types";


const formSchema = z.object({
  otp: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

export function OtpForm({ userId, contact, channel, redirectTo = "/auth-check" }: { userId: number, contact: string, channel: 'sms' | 'email' | 'whatsapp' | 'in-app', redirectTo?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { openAlert } = useAlertDialog();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userId) {
      openAlert({ variant: "error", title: "Erreur", description: "L'identifiant de l'utilisateur est manquant." });
      return;
    }
    
    setIsLoading(true);
    const result = await verifyOtp(userId, values.otp);

    if (result.success && result.user && result.token) {
        if (typeof window !== 'undefined') {
            Cookies.set('cashpay-token', result.token, { expires: 7, secure: true, sameSite: 'strict' });
            localStorage.setItem('cashpay-user-profile', JSON.stringify(result.user));
        }

        // Use the redirectTo prop, and check if the original URL is in searchParams to redirect back
        const returnTo = searchParams.get('returnTo');
        router.push(returnTo || redirectTo);

    } else {
        if (!result.success) {
            openAlert({ variant: "error", title: "Échec de la vérification", description: result.error });
        }
    }
    setIsLoading(false);
  }

  const handleResendOtp = async () => {
    if (!userId || channel === 'in-app') return;
    setIsResending(true);
    await sendOtp(Number(userId), channel);
    setIsResending(false);
    openAlert({ variant: 'success', title: 'Code Renvoyé', description: `Un nouveau code a été envoyé à ${contact}.` });
  };
  
  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <Logo className="w-40 mb-4" />
        <CardTitle className="text-2xl">{t('otpFormTitle')}</CardTitle>
        <CardDescription>
            Un code à 6 chiffres a été envoyé à <strong>{contact}</strong>.
        </CardDescription>
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
            {channel !== 'in-app' && (
              <Button variant="link" onClick={handleResendOtp} disabled={isResending}>
                {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Renvoyer le code
              </Button>
            )}
          </div>
      </CardContent>
    </Card>
  );
}
