
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { findUserForLogin } from "@/lib/actions/auth.actions";
import { Loader2 } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { OnChatLogo } from "../feedback/on-chat-logo";

const formSchema = z.object({
  walletId: z.string().regex(/^[A-Z]{2}\d{10}$/, {
    message: "Format d'ID de portefeuille invalide.",
  }),
});

export function OnChatLoginForm() {
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

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
        // Redirect to the dedicated OnChat OTP page
        router.push(`/feedback/verify-otp?userId=${result.userId}&walletId=${values.walletId}`);
    } else {
        openAlert({
            variant: "error",
            title: t('loginToastFailedTitle', 'Login Failed'),
            description: result.error || "User not found or service error.",
        });
    }
    setIsLoading(false);
  }

  return (
    <Card className="bg-zinc-800/80 backdrop-blur-sm text-white border-white/10">
      <CardHeader className="items-center text-center">
        <OnChatLogo className="mb-4" />
        <CardTitle className="text-2xl text-white">{t('onChatLoginTitle')}</CardTitle>
        <CardDescription className="text-white/80">{t('onChatLoginDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
                control={form.control}
                name="walletId"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-white/90">{t('loginIdWalletLabel')}</FormLabel>
                    <FormControl>
                    <Input
                        type="text"
                        placeholder={t('loginIdWalletPlaceholder', 'e.g., CD0123456789')}
                        {...field}
                        maxLength={12}
                        className="bg-zinc-700 border-zinc-600 text-white"
                    />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('continueButton', 'Continue')}
            </Button>
            </form>
        </Form>
      </CardContent>
    </Card>
  );
}
