
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import Image from "next/image";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { cn } from "@/lib/utils";
import { purchaseAirtime } from "@/lib/actions/airtime.actions";
import type { User, Currency } from '@/lib/types';
import { Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import { getExchangeRatesForCountry } from "@/lib/actions/exchange.actions";
import { countryToCode } from "@/lib/utils";

// Simplified for Airtel-only integration
const AirtelLogo = () => <div className="flex items-center justify-center h-12 w-24 rounded-md bg-white p-1"><Image src="/logos/airtel.png" alt="Airtel" width={80} height={30} objectFit="contain" /></div>;

const amounts = ["1", "2", "5", "10", "20"];

const formSchema = z.object({
  operator: z.string().default("airtel"), // Hardcoded to Airtel
  phoneNumber: z.string().min(9, { message: "Phone number must be at least 9 digits." }),
  amount: z.string({ required_error: "Please select an amount." }),
  paymentCurrency: z.string({ required_error: "Veuillez sélectionner une devise de paiement."}),
});

export function AirtimeForm({ user }: { user: User | null }) {
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userCurrencies, setUserCurrencies] = useState<Currency[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: user?.phone || "",
      operator: "airtel",
      amount: "",
      paymentCurrency: userCurrencies.find(c => c.code === 'USD')?.code || 'USD',
    },
  });

  const paymentCurrency = form.watch('paymentCurrency');
  const amountToPayUSD = Number(form.watch('amount'));

  useEffect(() => {
    if(user) {
      getUserCurrencies(user.id).then(setUserCurrencies);
    }
  }, [user]);

  useEffect(() => {
    const fetchRate = async () => {
      if (paymentCurrency && paymentCurrency !== 'USD' && user?.country) {
        const userCountryCode = countryToCode(user.country);
        if (userCountryCode) {
            const rates = await getExchangeRatesForCountry(userCountryCode);
            const rate = rates.find(r => r.from_currency === 'USD' && r.to_currency === paymentCurrency)?.rate;
            setExchangeRate(rate || null);
        }
      } else {
        setExchangeRate(1);
      }
    };
    fetchRate();
  }, [paymentCurrency, user?.country]);


  const totalDebitAmount = useMemo(() => {
    if (!amountToPayUSD || !exchangeRate) return 0;
    return amountToPayUSD * exchangeRate;
  }, [amountToPayUSD, exchangeRate]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      openAlert({ variant: "error", title: "Error", description: "User not found." });
      return;
    }
    setIsSubmitting(true);
    const result = await purchaseAirtime({
      user,
      operator: values.operator,
      phoneNumber: values.phoneNumber,
      amountUSD: Number(values.amount),
      paymentCurrency: values.paymentCurrency,
    });

    if (result.success) {
      openAlert({
        variant: "success",
        title: t('airtimeToastSuccessTitle'),
        description: t('airtimeToastSuccessDescription', {amount: values.amount, phoneNumber: values.phoneNumber}),
      });
      form.reset({ phoneNumber: user.phone || "", operator: "airtel", amount: "" });
    } else {
      openAlert({
        variant: "error",
        title: "Échec de l'achat",
        description: result.error,
      });
    }
    setIsSubmitting(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('airtimeFormTitle')}</CardTitle>
        <CardDescription>
            {t('airtimeFormDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-3">
              <FormLabel>{t('airtimeSelectOperator')}</FormLabel>
              <div className="p-4 border rounded-lg bg-muted/50">
                  <AirtelLogo />
              </div>
            </div>

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('airtimePhoneNumberLabel')}</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder={t('airtimePhoneNumberPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t('airtimeSelectAmount')}</FormLabel>
                   <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-3 md:grid-cols-5 gap-4"
                    >
                      {amounts.map((amount) => (
                        <FormItem key={amount}>
                           <FormControl>
                            <RadioGroupItem value={amount} id={`${field.name}-${amount}`} className="sr-only" />
                           </FormControl>
                           <FormLabel
                            htmlFor={`${field.name}-${amount}`}
                            className={cn(
                              "flex h-12 items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer font-semibold",
                              field.value === amount && "border-primary"
                            )}
                          >
                           ${amount}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="paymentCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payer avec le portefeuille</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un portefeuille" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {userCurrencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} (Solde: {c.balance})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {totalDebitAmount > 0 && (
              <p className="text-center text-muted-foreground text-sm">
                Total à débiter: ~{totalDebitAmount.toFixed(2)} {paymentCurrency}
              </p>
            )}

            <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('airtimePurchaseButton')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
