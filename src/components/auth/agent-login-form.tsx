
"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { findUserForLogin, verifyAgentPin } from "@/lib/actions/auth.actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { Seller, Session } from "@/lib/types";
import Cookies from "js-cookie";


const entrepreneurSchema = z.object({
  walletId: z.string().regex(/^[A-Z]{2}\d{10}$/, "Format d'ID de portefeuille invalide."),
});

const workerSchema = z.object({
  phone: z.string().min(9, "Le numéro de téléphone est requis."),
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

export function AgentLoginForm() {
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
      setIsClient(true);
  }, []);

  const entrepreneurForm = useForm<z.infer<typeof entrepreneurSchema>>({
    resolver: zodResolver(entrepreneurSchema),
    defaultValues: { walletId: "" },
  });

  const workerForm = useForm<z.infer<typeof workerSchema>>({
    resolver: zodResolver(workerSchema),
    defaultValues: { phone: "", pin: "" },
  });

  async function onEntrepreneurSubmit(values: z.infer<typeof entrepreneurSchema>) {
    const result = await findUserForLogin(values.walletId);
    if (result.success) {
        router.push(`/agent/verify-otp?userId=${result.userId}`);
    } else {
        openAlert({ variant: "error", title: "Échec de la connexion", description: result.error || "Utilisateur non trouvé." });
    }
  }

  async function onWorkerSubmit(values: z.infer<typeof workerSchema>) {
    const result = await verifyAgentPin(values.phone, values.pin);
    
    if (result.success && result.user && result.token) {
        const session = { 
            loggedInAt: Date.now(), 
            role: 'agent',
            user: result.user
        };
        localStorage.setItem('session', JSON.stringify(session));
        Cookies.set('cashpay-token', result.token, { expires: 7, secure: true, sameSite: 'strict' });
        localStorage.setItem('cashpay-user-profile', JSON.stringify(result.user));

        router.push("/agent/dashboard");
    } else {
        openAlert({ variant: "error", title: "Échec de la connexion", description: result.error || 'Identifiants incorrects.' });
    }
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <Logo className="w-40 mb-4" />
        <CardTitle className="text-2xl">Espace Agent</CardTitle>
        <CardDescription>Connectez-vous en tant qu'entrepreneur ou travailleur.</CardDescription>
      </CardHeader>
      <CardContent>
        {isClient ? (
        <Tabs defaultValue="entrepreneur" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entrepreneur">Entrepreneur</TabsTrigger>
            <TabsTrigger value="travailleur">Travailleur</TabsTrigger>
          </TabsList>
          <TabsContent value="entrepreneur" className="pt-6">
            <Form {...entrepreneurForm}>
              <form onSubmit={entrepreneurForm.handleSubmit(onEntrepreneurSubmit)} className="space-y-6">
                <FormField
                  control={entrepreneurForm.control}
                  name="walletId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Portefeuille CashPay</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: CP0123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="gradient" className="w-full font-bold">Envoyer le code OTP</Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="travailleur" className="pt-6">
            <Form {...workerForm}>
              <form onSubmit={workerForm.handleSubmit(onWorkerSubmit)} className="space-y-6">
                <FormField
                  control={workerForm.control}
                  name="phone"
                  render={({ field }) => (
                     <FormItem>
                      <FormLabel>Numéro de téléphone</FormLabel>
                       <FormControl>
                        <Input type="tel" placeholder="Ex: 812345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={workerForm.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIN à 4 chiffres</FormLabel>
                      <FormControl>
                        <div className="flex justify-center">
                            <InputOTP maxLength={4} {...field}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="gradient" className="w-full font-bold">Se Connecter</Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
        ) : <p>Chargement...</p>}
      </CardContent>
    </Card>
  );
}
