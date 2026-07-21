
"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, AlertCircle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { createLoanApplication } from "@/lib/actions/loan.actions";
import type { User, Currency } from "@/lib/types";

// Define loan limits for first-time and regular borrowers
const firstLoanLimits = {
    USD: { min: 1, max: 100, step: 1, symbol: '$' },
    CDF: { min: 5000, max: 300000, step: 1000, symbol: 'FC' },
};
const regularLoanLimits = {
    USD: { min: 1, max: 50000, step: 50, symbol: '$' },
    CDF: { min: 5000, max: 142500000, step: 1000, symbol: 'FC' },
};

const IS_FIRST_LOAN = true; 
const loanConfig = IS_FIRST_LOAN ? firstLoanLimits : regularLoanLimits;

const formSchema = z.object({
  currency: z.string({ required_error: "Please select a currency." }),
  amount: z.coerce.number(),
  purpose: z.string({ required_error: "Please select a loan purpose." }),
  duration: z.number().min(3).max(24),
});

export function LoanForm({ user, currencies }: { user: User | null, currencies: Currency[] }) {
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [collateralError, setCollateralError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  const loanPurposes = [
    t('loanPurposeBusiness'),
    t('loanPurposeEducation'),
    t('loanPurposeMedical'),
    t('loanPurposeRenovation'),
    t('loanPurposePersonal'),
    t('loanPurposeOther'),
  ];
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currency: "USD",
      amount: loanConfig.USD.min,
      duration: 12,
      purpose: loanPurposes[4],
    },
  });

  const watchedCurrency = form.watch("currency");
  const watchedAmount = form.watch("amount");
  const watchedDuration = form.watch("duration");

  const config = loanConfig[watchedCurrency as keyof typeof loanConfig] || loanConfig.USD;
  
  useEffect(() => {
    setIsClient(true);
    const newConfig = loanConfig[watchedCurrency as keyof typeof loanConfig];
    if (newConfig) {
      form.setValue("amount", newConfig.min, { shouldValidate: true });
    }
  }, [watchedCurrency, form]);

  useEffect(() => {
    if (!isClient) return;
    const selectedCurrencyData = currencies.find(c => c.code === watchedCurrency);
    const balance = selectedCurrencyData ? parseFloat(selectedCurrencyData.balance.replace(/,/g, '')) : 0;
    const numericAmount = Number(watchedAmount);

    if (balance < numericAmount * 0.20) {
        setCollateralError(t('loanCollateralError', {
            required: (numericAmount * 0.20).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            currency: watchedCurrency,
            balance: balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            symbol: config.symbol,
        }));
    } else {
        setCollateralError(null);
    }
  }, [watchedAmount, watchedCurrency, currencies, t, isClient, config.symbol]);


  const handleAmountChange = (value: number[]) => {
      form.setValue("amount", value[0], { shouldValidate: true });
  }

  const handleDurationChange = (value: number[]) => {
      form.setValue("duration", value[0], { shouldValidate: true });
  }
  
  const interestRatePerMonth = 0.0366;
  const totalInterest = watchedAmount * interestRatePerMonth * watchedDuration;
  const totalRepayment = watchedAmount + totalInterest;
  const estimatedMonthlyPayment = watchedDuration > 0 ? (totalRepayment / watchedDuration).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        openAlert({ variant: "error", title: t('error'), description: "You must be logged in." });
        return;
    }

    const result = await createLoanApplication({
        user,
        amount: values.amount,
        currency: values.currency,
        durationMonths: values.duration,
        purpose: values.purpose,
        interestRate: interestRatePerMonth * 100
    });

    if (result.success) {
        openAlert({
            variant: "success",
            title: t('loanToastSuccessTitle'),
            description: t('loanToastSuccessDescription'),
        });
        form.reset();
    } else {
        openAlert({
            variant: "error",
            title: t('error'),
            description: result.error,
        });
    }
  }
  
  if (!isClient) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('loanFormTitle')}</CardTitle>
        <CardDescription>{t('loanFormDescription')}</CardDescription>
        <Alert variant="default" className="mt-4 bg-primary/5 border-primary/20">
          <Info className="h-4 w-4 !text-primary/80" />
          <AlertTitle className="text-primary font-semibold">{t('loanRulesTitle')}</AlertTitle>
          <AlertDescription className="text-primary/90">
            <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>{t('loanCollateralInfo')}</li>
                {IS_FIRST_LOAN && <li>{t('loanFirstLoanInfo', { amount: loanConfig.USD.max.toLocaleString('en-US'), currency: 'USD' })}</li>}
                <li>{t('loanProgressionInfo')}</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('loanCurrencyLabel')}</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('loanCurrencyPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CDF">CDF</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>{t('loanAmountLabel')} <span className="font-bold text-primary">{config.symbol}{field.value.toLocaleString('en-US')}</span></FormLabel>
                  <FormControl>
                      <Slider
                      value={[field.value]}
                      min={config.min}
                      max={config.max}
                      step={config.step}
                      onValueChange={handleAmountChange}
                      />
                  </FormControl>
                  <FormMessage />
                  </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>{t('loanPurposeLabel')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder={t('loanPurposePlaceholder')} />
                      </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                      {loanPurposes.map((purpose) => (
                          <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>
                      ))}
                      </SelectContent>
                  </Select>
                  <FormMessage />
                  </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>{t('loanDurationLabel')} <span className="font-bold text-primary">{field.value} {t('loanDurationUnit')}</span></FormLabel>
                  <FormControl>
                      <Slider value={[field.value]} min={3} max={24} step={1} onValueChange={handleDurationChange} />
                  </FormControl>
                  <FormMessage />
                  </FormItem>
              )}
            />

            {collateralError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{collateralError}</AlertDescription>
              </Alert>
            )}

            <Card className="bg-muted/50">
                <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">{t('loanEstimatedPaymentLabel')}</p>
                    <p className="text-2xl font-bold text-foreground">{config.symbol}{estimatedMonthlyPayment}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('loanEstimatedPaymentDescription')}</p>
                </CardContent>
            </Card>

            <Button type="submit" variant="gradient" className="w-full font-bold" disabled={!!collateralError}>
              {t('loanSubmitButton')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
