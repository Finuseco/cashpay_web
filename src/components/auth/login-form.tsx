
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { findUserForLogin } from "@/lib/actions/auth.actions";
import { Loader2 } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

const formSchema = z.object({
  walletId: z.string().regex(/^[A-Z]{2}\d{10}$/, {
    message: "Format d'ID de portefeuille invalide.",
  }),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      walletId: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    const result = await findUserForLogin(values.walletId);

    if (result.success) {
        const returnTo = searchParams.get('returnTo');
        const redirectUrl = `/verify-otp?userId=${result.userId}&walletId=${values.walletId}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`;
        router.push(redirectUrl);
    } else {
        openAlert({
            variant: "error",
            title: t('loginToastFailedTitle', 'Login Failed'),
            description: result.error || "User not found or service error.",
        });
        setIsLoading(false);
    }
  }

  if (!isClient) {
    return (
        <Card className="bg-card shadow-2xl">
          <CardHeader className="items-center text-center">
            <Logo className="w-40 mb-4" />
             <div className="space-y-2">
                <Skeleton className="h-8 w-48 mx-auto" />
                <Skeleton className="h-4 w-64 mx-auto" />
             </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
                <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-5 w-3/4 mx-auto" />
            </div>
          </CardContent>
        </Card>
    );
  }


  return (
    <Card className="bg-card shadow-2xl">
      <CardHeader className="items-center text-center">
        <Logo className="w-40 mb-4" />
        <CardTitle className="text-2xl">{t('loginTitle')}</CardTitle>
        <CardDescription>{t('loginDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
                control={form.control}
                name="walletId"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('loginIdWalletLabel')}</FormLabel>
                    <FormControl>
                    <Input
                        type="text"
                        placeholder={t('loginIdWalletPlaceholder', 'e.g., CD0123456789')}
                        {...field}
                        maxLength={12}
                    />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('loginSubmitButton')}
            </Button>
            </form>
        </Form>
        <div className="mt-6 text-center text-sm">
            {t('loginNoAccount')}{" "}
            <Link href="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t('loginSignUpLink')}
            </Link>
        </div>
      </CardContent>
    </Card>
  );
}
