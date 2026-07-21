
'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { Country, Province } from '@/lib/types';
import { Skeleton } from "../ui/skeleton";
import { getProvincesByCountry } from "@/lib/actions/province.actions";
import { LanguageSwitcher } from "../ui/language-switcher";

const formSchema = z.object({
  country: z.string({ required_error: "Veuillez sélectionner un pays." }),
  province: z.string().optional(),
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
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [dialCode, setDialCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [isDialCodePopoverOpen, setIsDialCodePopoverOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      preferred_otp_channel: 'sms',
      phone: '',
      country: 'CD', // Default to RDC
      language: i18n.language || 'fr',
    },
  });
  
  const { getValues, watch, setError, clearErrors } = form;
  const selectedCountryCode = watch('country');
  const phoneNumber = watch('phone');


  useEffect(() => {
    const fetchCountries = async () => {
        setIsDataLoading(true);
        const countryList = await getCountriesList();
        setCountries(countryList);
        const rdc = countryList.find(c => c.code === 'CD');
        if (rdc) setDialCode(rdc.dial_code);
        setIsDataLoading(false);
    };
    fetchCountries();
  }, []);
  
  useEffect(() => {
      setIsClient(true);
  }, []);

  useEffect(() => {
    if (selectedCountryCode) {
        const countryData = countries.find(c => c.code === selectedCountryCode);
        if (countryData) {
            setDialCode(countryData.dial_code);
            const fetchProvinces = async () => {
                const fetchedProvinces = await getProvincesByCountry(selectedCountryCode);
                setProvinces(fetchedProvinces);
                form.resetField('province'); // Reset province when country changes
            }
            fetchProvinces();
        }
    }
   }, [selectedCountryCode, countries, form]);
   
  useEffect(() => {
    // Reset verification status when phone number changes
    setIsPhoneVerified(false);
  }, [phoneNumber, selectedCountryCode]);


  const handleVerifyPhone = async () => {
      const phoneValue = getValues('phone');
      const dialCodeValue = dialCode;
      
      if (!phoneValue || phoneValue.length < 9) {
          form.setError("phone", { type: "manual", message: "Numéro de téléphone invalide." });
          return;
      }
      clearErrors("phone");
      
      const fullNumber = `${dialCodeValue}${phoneValue}`;

      setIsVerifying(true);
      const { exists } = await checkExistingUser(fullNumber);
      setIsVerifying(false);

      if (exists) {
          setIsPhoneVerified(false);
          openAlert({
            title: "Numéro Existant",
            description: "Ce numéro de téléphone est déjà associé à un compte CashPay.",
            variant: "error"
          });
      } else {
          setIsPhoneVerified(true);
          openAlert({
            title: "Numéro Valide",
            description: "Ce numéro de téléphone est disponible.",
            variant: "success"
          });
      }
  };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isPhoneVerified) {
        openAlert({ title: "Vérification requise", description: "Veuillez d'abord vérifier votre numéro de téléphone.", variant: "warning" });
        return;
    }

    setIsLoading(true);
    const destination = `${dialCode}${values.phone}`;
    const otpResult = await sendRegistrationOtp(destination, values.preferred_otp_channel);
    
    const countryInfo = countries.find(c => c.code === values.country);
    const countryName = countryInfo?.name || '';
    
    const referralCode = searchParams.get('ref');
    
    const destinationUrl = `/verify-register-otp?phone=${encodeURIComponent(destination)}&country=${values.country}&countryName=${encodeURIComponent(countryName)}${values.province ? `&province=${encodeURIComponent(values.province)}` : ''}${referralCode ? `&ref=${referralCode}` : ''}&lang=${values.language}`;

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
  
  const FormSkeleton = () => (
    <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-5 w-32"/><Skeleton className="h-10 w-full"/></div>
        <div className="space-y-2"><Skeleton className="h-5 w-24"/><Skeleton className="h-10 w-48"/></div>
        <Skeleton className="h-12 w-full"/>
    </div>
  );

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <Logo className="w-40 mb-4" />
        <CardTitle className="text-2xl">{t('registerTitle')}</CardTitle>
        <CardDescription>{t('registerDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isDataLoading ? <FormSkeleton /> : (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('phoneLabel')}</FormLabel>
                        <div className="flex items-start gap-2">
                            <Popover open={isDialCodePopoverOpen} onOpenChange={setIsDialCodePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-[120px] shrink-0 rounded-r-none justify-between">
                                        {dialCode || 'Indicatif'}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Rechercher pays..."/>
                                        <CommandList>
                                            <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
                                            <CommandGroup>
                                                {countries.map(country => (
                                                    <CommandItem key={country.code} value={`${country.name} ${country.dial_code}`} onSelect={() => { form.setValue('country', country.code); setIsDialCodePopoverOpen(false); }}>
                                                        <Check className={cn("mr-2 h-4 w-4", selectedCountryCode === country.code ? 'opacity-100' : 'opacity-0')} />
                                                        <Image src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`} width={20} height={15} alt="" className="mr-2"/>
                                                        <span className="flex-1">{country.name}</span>
                                                        <span className="text-muted-foreground">{country.dial_code}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                             <div className="w-full">
                                <div className="flex items-center gap-2">
                                  <FormControl><Input type="tel" placeholder="812345678" className="rounded-l-none" {...field} /></FormControl>
                                  <Button type="button" onClick={handleVerifyPhone} disabled={isVerifying || !field.value} variant="secondary">
                                      {isVerifying ? <Loader2 className="animate-spin h-4 w-4"/> : 'Vérifier'}
                                  </Button>
                                </div>
                                <FormMessage />
                            </div>
                        </div>
                    </FormItem>
                )}/>

                <FormField control={form.control} name="country" render={() => (
                    <FormItem>
                        <FormLabel>{t('detectedCountryLabel')}</FormLabel>
                        <Input value={currentCountry?.name || ''} readOnly disabled className="bg-muted"/>
                    </FormItem>
                )}/>
                
                {provinces.length > 0 && (
                     <FormField control={form.control} name="province" render={({ field }) => (
                        <FormItem><FormLabel>{t('provinceLabel')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('selectProvincePlaceholder')} /></SelectTrigger></FormControl><SelectContent>{provinces.map(p => <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>)}</SelectContent></Select>
                        <FormMessage /></FormItem>
                    )}/>
                )}
                
                <FormField control={form.control} name="preferred_otp_channel" render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>{t('receiveCodeViaLabel')}</FormLabel>
                        <FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                            <FormItem><FormControl><RadioGroupItem value="sms" id="sms" className="sr-only" /></FormControl><FormLabel htmlFor="sms" className={cn("cursor-pointer border-2 rounded-md p-3", field.value === 'sms' ? 'border-primary' : '')}>SMS</FormLabel></FormItem>
                            <FormItem><FormControl><RadioGroupItem value="whatsapp" id="whatsapp" className="sr-only" /></FormControl><FormLabel htmlFor="whatsapp" className={cn("cursor-pointer border-2 rounded-md p-3", field.value === 'whatsapp' ? 'border-primary' : '')}>WhatsApp</FormLabel></FormItem>
                        </RadioGroup></FormControl>
                    </FormItem>
                )}/>
                <FormField control={form.control} name="language" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('appearanceLanguageLabel')}</FormLabel>
                        <LanguageSwitcher />
                        <FormMessage />
                    </FormItem>
                )}/>
                
                <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isLoading || isDataLoading || !isPhoneVerified}>
                    {(isLoading || isDataLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('registerSubmitButton')}
                </Button>
            </form>
            </Form>
        )}
        <div className="mt-6 text-center text-sm">
          {t('registerHasAccount')}{" "}
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t('registerSignInLink')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

    