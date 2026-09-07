'use client';

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
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
import { Logo } from "@/components/logo";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { cn } from "@/lib/utils";
import { sendRegistrationOtp, checkExistingUser } from "@/lib/actions/auth.actions";
import { getCountriesList } from "@/lib/actions/countries.actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { Country } from '@/lib/types';
import { LanguageSwitcher } from "@/components/ui/language-switcher";

const formSchema = z.object({
  country: z.string({ required_error: "Veuillez sélectionner un pays." }),
  phone: z.string().min(9, 'Le numéro de téléphone est requis.'),
  preferred_otp_channel: z.enum(['sms', 'whatsapp'], { required_error: "Veuillez choisir où recevoir le code." }),
  language: z.string({ required_error: "Veuillez sélectionner votre langue." }),
});

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAlert } = useAlertDialog();
  const { t, i18n } = useTranslation();
  
  const [countries, setCountries] = useState<Country[]>([]);
  const [dialCode, setDialCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isDialCodePopoverOpen, setIsDialCodePopoverOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onSubmit',
    defaultValues: {
      preferred_otp_channel: 'sms',
      phone: '',
      country: 'CD',
      language: i18n.language || 'fr',
    },
  });
  
  const selectedCountryCode = form.watch('country');

  useEffect(() => {
    const fetchCountries = async () => {
        setIsDataLoading(true);
        try {
            const countryList = await getCountriesList();
            setCountries(countryList);
            const rdc = countryList.find(c => c.code === 'CD');
            if (rdc) setDialCode(rdc.dial_code);
        } catch (e) {
            console.error("Error loading countries", e);
        } finally {
            setIsDataLoading(false);
        }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    if (selectedCountryCode && countries.length > 0) {
        const countryData = countries.find(c => c.code === selectedCountryCode);
        if (countryData) {
            setDialCode(countryData.dial_code);
        }
    }
   }, [selectedCountryCode, countries]);

  const handleVerifyPhone = async () => {
      const phoneValue = form.getValues('phone');
      if (!phoneValue || phoneValue.length < 9) {
          form.setError("phone", { type: "manual", message: "Le numéro doit comporter au moins 9 chiffres (sans le 0)." });
          return;
      }
      
      // Concaténation : Indicatif (sans le +) + les chiffres saisis
      const sanitizedDialCode = dialCode.replace('+', '');
      const fullNumber = `${sanitizedDialCode}${phoneValue}`;
      
      setIsVerifying(true);
      try {
          const { exists } = await checkExistingUser(fullNumber);
          if (exists) {
              setIsPhoneVerified(false);
              openAlert({
                title: "Numéro déjà enregistré",
                description: `Le numéro ${fullNumber} est déjà associé à un compte. Veuillez vous connecter.`,
                variant: "error"
              });
          } else {
              setIsPhoneVerified(true);
              openAlert({
                title: "Numéro disponible",
                description: "Ce numéro est valide pour une nouvelle inscription.",
                variant: "success"
              });
          }
      } catch (e) {
          openAlert({ title: "Erreur", description: "Impossible de vérifier le numéro pour le moment.", variant: "error" });
      } finally {
          setIsVerifying(false);
      }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isPhoneVerified) {
        openAlert({ title: "Vérification requise", description: "Veuillez d'abord vérifier la disponibilité du numéro via l'icône loupe.", variant: "warning" });
        return;
    }

    setIsLoading(true);
    const sanitizedDialCode = dialCode.replace('+', '');
    const fullDestination = `${sanitizedDialCode}${values.phone}`;
    const otpResult = await sendRegistrationOtp(fullDestination, values.preferred_otp_channel);
    
    const countryInfo = countries.find(c => c.code === values.country);
    const countryName = countryInfo?.name || '';
    const referralCode = searchParams.get('ref');
    
    const destinationUrl = `/verify-register-otp?phone=${encodeURIComponent(fullDestination)}&country=${values.country}&countryName=${encodeURIComponent(countryName)}${referralCode ? `&ref=${referralCode}` : ''}&lang=${values.language}`;

    if (otpResult.success) {
      router.push(destinationUrl);
    } else {
       openAlert({
        variant: "error",
        title: "Échec de l'envoi",
        description: otpResult.error || 'Un problème est survenu lors de l\'envoi du code.',
      });
    }
    setIsLoading(false);
  }

  const currentCountry = countries.find(c => c.code === selectedCountryCode);

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <Logo className="w-40 mb-4" />
        <CardTitle className="text-2xl">{t('registerTitle')}</CardTitle>
        <CardDescription>{t('registerDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isDataLoading ? (
            <div className="space-y-6">
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                <div className="h-12 w-full bg-muted animate-pulse rounded-md" />
            </div>
        ) : (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('phoneLabel')}</FormLabel>
                        <div className="flex items-start gap-2">
                            <Popover open={isDialCodePopoverOpen} onOpenChange={setIsDialCodePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-[110px] shrink-0 rounded-r-none justify-between h-12">
                                        {dialCode || '+...'}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-0" align="start">
                                    <Command>
                                        <div className="flex items-center border-b px-3">
                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                            <CommandInput placeholder="Rechercher un pays..." className="h-11 border-none focus:ring-0" />
                                        </div>
                                        <CommandList>
                                            <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
                                            <CommandGroup>
                                                {countries.map(country => (
                                                    <div 
                                                        key={country.code} 
                                                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent transition-colors"
                                                        onClick={() => { form.setValue('country', country.code); setIsDialCodePopoverOpen(false); }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", selectedCountryCode === country.code ? 'opacity-100' : 'opacity-0')} />
                                                        <Image src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`} width={20} height={15} alt="" className="mr-2"/>
                                                        <span className="flex-1">{country.name}</span>
                                                        <span className="text-muted-foreground text-xs">{country.dial_code}</span>
                                                    </div>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                             <div className="w-full">
                                <div className="flex items-center gap-2">
                                  <FormControl><Input type="tel" placeholder="812345678" className="rounded-l-none h-12" {...field} onChange={(e) => { field.onChange(e); setIsPhoneVerified(false); }} /></FormControl>
                                  <Button type="button" onClick={handleVerifyPhone} disabled={isVerifying || !field.value} variant="secondary" className="h-12 w-12 p-0">
                                      {isVerifying ? <Loader2 className="animate-spin h-5 w-5"/> : <Search className="h-5 w-5" />}
                                  </Button>
                                </div>
                                <FormMessage />
                            </div>
                        </div>
                    </FormItem>
                )}/>

                <FormItem>
                    <FormLabel>{t('detectedCountryLabel')}</FormLabel>
                    <Input value={currentCountry?.name || ''} readOnly disabled className="bg-muted h-12"/>
                </FormItem>
                
                <FormField control={form.control} name="preferred_otp_channel" render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>{t('receiveCodeViaLabel')}</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                            <FormItem className="flex-1">
                              <FormControl><RadioGroupItem value="sms" id="sms" className="sr-only" /></FormControl>
                              <FormLabel htmlFor="sms" className={cn("flex items-center justify-center cursor-pointer border-2 rounded-xl p-3 h-12 transition-all", field.value === 'sms' ? 'border-primary bg-primary/5 font-bold' : 'border-muted')}>SMS</FormLabel>
                            </FormItem>
                            <FormItem className="flex-1">
                              <FormControl><RadioGroupItem value="whatsapp" id="whatsapp" className="sr-only" /></FormControl>
                              <FormLabel htmlFor="whatsapp" className={cn("flex items-center justify-center cursor-pointer border-2 rounded-xl p-3 h-12 transition-all", field.value === 'whatsapp' ? 'border-primary bg-primary/5 font-bold' : 'border-muted')}>WhatsApp</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                    </FormItem>
                )}/>

                <div className="space-y-2">
                   <FormLabel>{t('appearanceLanguageLabel')}</FormLabel>
                   <LanguageSwitcher />
                </div>
                
                <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-lg" disabled={isLoading || !isPhoneVerified}>
                    {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    {t('registerSubmitButton')}
                </Button>
            </form>
            </Form>
        )}
        <div className="mt-8 text-center text-sm">
          {t('registerHasAccount')}{" "}
          <Link href="/login" className="font-bold text-primary underline-offset-4 hover:underline">
            {t('registerSignInLink')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
