
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
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
import { verifyOtp, getOtpContactDetails } from "@/lib/actions/auth.actions";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { Loader2 } from "lucide-react";
import Cookies from 'js-cookie';

const formSchema = z.object({
  otp: z.string().min(6, "Your one-time password must be 6 characters."),
});

export function AgentOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const { openAlert } = useAlertDialog();
  const [contactDetails, setContactDetails] = useState<{ phone?: string | null; email?: string | null; maskedPhone?: string; maskedEmail?: string; } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      getOtpContactDetails(Number(userId)).then(details => {
        setContactDetails(details);
        setIsLoading(false);
      });
    } else {
      router.push('/agent/login');
    }
  }, [userId, router]);
  

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userId) {
      openAlert({ variant: "error", title: "Error", description: "User ID is missing." });
      return;
    }
    
    setIsLoading(true);
    const result = await verifyOtp(Number(userId), values.otp);

    if (result.success && result.user && result.token && (result.user.role === 'Agent' || result.user.role === 'Admin')) {
        // Here we set the session for the agent flow
        const session = { loggedInAt: Date.now(), role: 'agent', user: result.user };
        localStorage.setItem('session', JSON.stringify(session));
        Cookies.set('cashpay-token', result.token, { expires: 7, secure: true, sameSite: 'strict' });
        localStorage.setItem('cashpay-user-profile', JSON.stringify(result.user));
        router.push(`/agent/dashboard`);
    } else {
        // Check for success: false to safely access the error property
        const errorMessage = result.success === false ? result.error : "Cet utilisateur n'est pas un agent ou une erreur est survenue.";
        openAlert({ variant: "error", title: "Verification Failed", description: errorMessage });
    }
    setIsLoading(false);
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <Logo className="w-40 mb-4" />
        <CardTitle className="text-2xl">Vérification Entrepreneur</CardTitle>
        <CardDescription>Un code à 6 chiffres a été envoyé à votre téléphone.</CardDescription>
        {isLoading ? <Skeleton className="h-5 w-40 mt-2" /> : (
            contactDetails?.maskedPhone && <p className="text-sm text-muted-foreground pt-2">Téléphone : {contactDetails.maskedPhone}</p>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code de vérification</FormLabel>
                   <FormControl>
                    <div className="flex justify-center">
                        <InputOTP maxLength={6} {...field} pattern="[0-9]*" inputMode="numeric">
                            <InputOTPGroup className="bg-muted">
                                <InputOTPSlot index={0} render={({ char, isActive }) => (<span>{char ? "●" : isActive ? " " : null}</span>)} />
                                <InputOTPSlot index={1} render={({ char, isActive }) => (<span>{char ? "●" : isActive ? " " : null}</span>)} />
                                <InputOTPSlot index={2} render={({ char, isActive }) => (<span>{char ? "●" : isActive ? " " : null}</span>)} />
                                <InputOTPSlot index={3} render={({ char, isActive }) => (<span>{char ? "●" : isActive ? " " : null}</span>)} />
                                <InputOTPSlot index={4} render={({ char, isActive }) => (<span>{char ? "●" : isActive ? " " : null}</span>)} />
                                <InputOTPSlot index={5} render={({ char, isActive }) => (<span>{char ? "●" : isActive ? " " : null}</span>)} />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Vérifier et Accéder
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
