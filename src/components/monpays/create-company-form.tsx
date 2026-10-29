'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Loader2, UploadCloud, X } from 'lucide-react';

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

import type { MonPaysCategory } from '@/lib/types';

import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createMonPaysCompany, getMonPaysCreationFee } from '@/lib/actions/monpays.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
// calculateTransactionFee remplacé par getMonPaysCreationFee (gère country_code user + conversion)
// getExchangeRatesForCountry supprimé — la conversion est gérée dans getMonPaysCreationFee

const categories: MonPaysCategory[] = [
    'E-commerce',
    'Finance numérique',
    'Startups et fintech',
    'Banques digitales',
    'Sites d’actualités',
    'Hôtels',
    'Écoles',
    'Services publics',
    'Transferts d’argent',
    'Streaming',
    'Entreprises locales',
];

const companyFormSchema = z.object({
    name: z.string().min(3, {
        message: "Le nom de l'entreprise est requis.",
    }),
    category: z.string({
        required_error: 'Veuillez sélectionner une catégorie.',
    }),
    country: z.string({
        required_error: 'Veuillez sélectionner le pays.',
    }),
    website: z.string().url({
        message: 'Veuillez entrer une URL valide.',
    }).optional().or(z.literal('')),
    address: z.string().min(10, {
        message: "L'adresse complète est requise.",
    }),
    rccm: z.string().min(1, {
        message: 'Le numéro RCCM est requis.',
    }),
    nif: z.string().min(1, {
        message: "L'ID National / NIF est requis.",
    }),
    phone: z.string().min(9, {
        message: 'Le numéro de téléphone est requis.',
    }),
    email: z.string().email({
        message: 'Veuillez entrer une adresse email valide.',
    }),
    logoUrl: z.string().optional(),
    bannerUrl: z.string().optional(),
    paymentCurrency: z.string({
        required_error: 'Veuillez choisir une devise pour le paiement.',
    }),
});

const pinSchema = z.object({
    pin: z.string().regex(/^\d{4}$/, {
        message: 'Le PIN doit contenir 4 chiffres.',
    }),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

type FileUploadProps = {
    label: string;
    preview: string | null;
    onFileSelect: (
        event: React.ChangeEvent<HTMLInputElement>
    ) => void;
    onRemove: () => void;
};

function FileUpload({
    label,
    preview,
    onFileSelect,
    onRemove,
}: FileUploadProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);

    return (
        <FormItem>
            <FormLabel>{label}</FormLabel>

            <FormControl>
                <div className="mt-2">
                    <label
                        htmlFor={label}
                        className="flex min-h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-zinc-600 bg-zinc-700/50 px-4 transition hover:border-red-500"
                    >
                        {preview ? (
                            <div className="relative flex h-32 w-full items-center justify-center">
                                <img
                                    src={preview}
                                    alt={`${label} preview`}
                                    className="max-h-28 max-w-full rounded object-contain"
                                />
                            </div>
                        ) : (
                            <span className="flex items-center gap-2 text-zinc-400">
                                <UploadCloud className="h-6 w-6" />
                                <span className="font-medium">
                                    Cliquer pour téléverser
                                </span>
                            </span>
                        )}

                        <input
                            ref={inputRef}
                            id={label}
                            type="file"
                            className="sr-only"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={onFileSelect}
                        />
                    </label>

                    {preview && (
                        <button
                            type="button"
                            onClick={() => {
                                onRemove();

                                if (inputRef.current) {
                                    inputRef.current.value = '';
                                }
                            }}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300"
                        >
                            <X className="h-4 w-4" />
                            Supprimer l'image
                        </button>
                    )}
                </div>
            </FormControl>

            <FormMessage />
        </FormItem>
    );
}

const parseCurrencyBalance = (
    value: string | number | undefined | null
): number => {
    if (value === undefined || value === null) return 0;

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const parsed = Number.parseFloat(
        String(value).replace(/,/g, '').trim()
    );

    return Number.isFinite(parsed) ? parsed : 0;
};

export function CreateCompanyForm() {
    const { openAlert } = useAlertDialog();
    const router = useRouter();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);

    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);

    const [creationFee, setCreationFee] = useState<number | null>(null);
    const [isLoadingFee, setIsLoadingFee] = useState(true);

    const [submissionData, setSubmissionData] =
        useState<CompanyFormValues | null>(null);

    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [walletCurrencies, setWalletCurrencies] =
        useState<Awaited<ReturnType<typeof getUserCurrencies>>>([]);

    const pinInputRef = useRef<HTMLInputElement | null>(null);

    const form = useForm<CompanyFormValues>({
        resolver: zodResolver(companyFormSchema),
        defaultValues: {
            name: '',
            category: '',
            country: 'CD',
            website: '',
            address: '',
            rccm: '',
            nif: '',
            phone: '',
            email: '',
            logoUrl: '',
            bannerUrl: '',
            paymentCurrency: '',
        },
    })

    const selectedPaymentCurrency = useWatch({
        control: form.control,
        name: "paymentCurrency",
    });

    const selectedWalletCurrency = walletCurrencies.find(
        currency =>
            currency.code.toUpperCase() ===
            selectedPaymentCurrency?.toUpperCase()
    );

    useEffect(() => {
    let mounted = true;

    const loadWalletCurrencies = async () => {
        try {
            const user = await getAuthenticatedUser();

            if (!user) return;

            const currencies = await getUserCurrencies(user.id);

            if (!mounted) return;

            setWalletCurrencies(currencies);

            const currentCurrency = form.getValues("paymentCurrency");

            const selectedCurrency =
                currencies.find(
                    currency =>
                        currency.code.toUpperCase() ===
                        currentCurrency?.toUpperCase()
                ) || currencies[0];

            if (selectedCurrency) {
                form.setValue(
                    "paymentCurrency",
                    selectedCurrency.code.toUpperCase(),
                    {
                        shouldDirty: false,
                        shouldValidate: true,
                    }
                );
            }
        } catch (error) {
            console.error(
                "[CreateCompanyForm] Wallet currencies error:",
                error
            );
        }
    };

    loadWalletCurrencies();

    return () => {
        mounted = false;
    };
}, [form]);
useEffect(() => {
        if (isPinDialogOpen) {
            setTimeout(() => {
                pinInputRef.current?.focus();
            }, 50);
        }
    }, [isPinDialogOpen]);

    const handleFileChange = (
        event: React.ChangeEvent<HTMLInputElement>,
        setPreview: (value: string | null) => void,
        fieldName: 'logoUrl' | 'bannerUrl'
    ) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            openAlert({
                variant: 'error',
                title: 'Fichier invalide',
                description: 'Veuillez sélectionner une image.',
            });

            event.target.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            openAlert({
                variant: 'error',
                title: 'Image trop volumineuse',
                description: "L'image ne doit pas dépasser 5 Mo.",
            });

            event.target.value = '';
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const result = reader.result;

            if (typeof result !== 'string') {
                return;
            }

            setPreview(result);

            form.setValue(fieldName, result, {
                shouldDirty: true,
                shouldValidate: true,
            });
        };

        reader.onerror = () => {
            openAlert({
                variant: 'error',
                title: 'Erreur',
                description:
                    "Impossible de lire l'image sélectionnée.",
            });

            event.target.value = '';
        };

        reader.readAsDataURL(file);
    };

    const removeLogo = () => {
        setLogoPreview(null);

        form.setValue('logoUrl', '', {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const removeBanner = () => {
        setBannerPreview(null);

        form.setValue('bannerUrl', '', {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    useEffect(() => {
        let mounted = true;

        const loadCreationFee = async () => {
            setIsLoadingFee(true);
            setCreationFee(null);

            try {
                const user = await getAuthenticatedUser();

                if (!user) {
                    throw new Error('Session utilisateur introuvable.');
                }

                const paymentCurrency =
                    selectedPaymentCurrency?.toUpperCase();

                if (!paymentCurrency) {
                    return;
                }

                // Frais récupérés depuis la DB selon le country_code de l'utilisateur
                // getMonPaysCreationFee gère : lookup par pays → fallback GBL → conversion devise
                const feeResult = await getMonPaysCreationFee(paymentCurrency);

                if (!feeResult.success || !Number.isFinite(feeResult.fee) || (feeResult.fee ?? 0) <= 0) {
                    throw new Error(
                        feeResult.error || "Le frais de création MonPays n'est pas configuré."
                    );
                }

                if (!mounted) {
                    return;
                }

                setCreationFee(feeResult.fee!);
            } catch (error) {
                console.error(
                    '[CreateCompanyForm] Erreur chargement frais MONPAYS_PAGE:',
                    error
                );

                if (!mounted) {
                    return;
                }

                setCreationFee(null);

                openAlert({
                    variant: 'error',
                    title: 'Frais indisponibles',
                    description:
                        error instanceof Error
                            ? error.message
                            : "Impossible de récupérer les frais de création.",
                });
            } finally {
                if (mounted) {
                    setIsLoadingFee(false);
                }
            }
        };

        loadCreationFee();

        return () => {
            mounted = false;
        };
    }, [selectedPaymentCurrency]);

    const onSubmit = (values: CompanyFormValues) => {
        console.log('[CreateCompanyForm] onSubmit appelé', values);

        setSubmissionData(values);
        setPin('');
        setPinError('');
        setIsPinDialogOpen(true);
    };

    const handlePinConfirm = async () => {
        console.log('[CreateCompanyForm] PIN confirm start', {
            pinLength: pin.length,
            hasSubmissionData: !!submissionData,
            paymentCurrency: submissionData?.paymentCurrency,
        });

        if (!submissionData) {
            console.error('[CreateCompanyForm] submissionData absent');
            return;
        }

        const validation = pinSchema.safeParse({ pin });

        console.log('[CreateCompanyForm] PIN validation', {
            success: validation.success,
        });

        if (!validation.success) {
            setPinError('Le PIN doit contenir exactement 4 chiffres.');
            return;
        }

        setPinError('');
        setIsSubmitting(true);

        try {
            console.log('[CreateCompanyForm] récupération utilisateur');

            const user = await getAuthenticatedUser();

            console.log('[CreateCompanyForm] utilisateur récupéré', {
                authenticated: !!user,
                userId: user?.id,
            });

            if (!user) {
                setIsSubmitting(false);
                setIsPinDialogOpen(false);
                openAlert({
                    variant: 'error',
                    title: 'Session expirée',
                    description:
                        'Veuillez vous reconnecter avant de créer une page entreprise.',
                });
                return;
            }

            console.log('[CreateCompanyForm] appel createMonPaysCompany', {
                name: submissionData.name,
                category: submissionData.category,
                country: submissionData.country,
                paymentCurrency: submissionData.paymentCurrency,
                hasLogo: !!submissionData.logoUrl,
                hasBanner: !!submissionData.bannerUrl,
            });

            const result = await createMonPaysCompany({
                user,
                pin: validation.data.pin,
                companyData: submissionData,
            });

            console.log('[CreateCompanyForm] résultat création', result);

            if (result.success) {
                setIsPinDialogOpen(false);
                setPin('');
                openAlert({
                    variant: 'success',
                    title: 'Demande soumise !',
                    description: `Votre demande de création pour l'entreprise "${submissionData.name}" a été soumise. ${
                        typeof result.fee === 'number' ? `Frais débités : ${result.fee.toFixed(2)} ${result.currency}. ` : ''
                    }Elle est maintenant en attente de validation par notre équipe.`,
                });
                router.push('/monpays/company/manage');
                return;
            }

            openAlert({
                variant: 'error',
                title: 'Erreur',
                description:
                    result.error ||
                    'Impossible de soumettre la demande.',
            });
        } catch (error) {
            console.error('[CreateCompanyForm] Creation error:', error);
            openAlert({
                variant: 'error',
                title: 'Erreur',
                description:
                    'Une erreur est survenue lors de la création de la page.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const closePinDialog = () => {
        if (isSubmitting) {
            return;
        }

        setIsPinDialogOpen(false);
        setPin('');
        setPinError('');
    };

    return (
        <>
            {isPinDialogOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="monpays-pin-title"
                >
                    <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6 text-white shadow-2xl">
                        <div className="mb-5">
                            <h2
                                id="monpays-pin-title"
                                className="text-lg font-semibold"
                            >
                                Confirmer la création
                            </h2>

                            <p className="mt-2 text-sm text-zinc-400">
                                Veuillez entrer votre PIN pour confirmer
                                le paiement des frais de création.
                            </p>

                            <div className="mt-4 rounded-md bg-zinc-800 p-4 text-center">
                                <div className="text-sm text-zinc-400">
                                    Frais de création
                                </div>

                                <div className="mt-1 text-xl font-bold">
                                    {creationFee !== null
                                        ? `${selectedWalletCurrency?.symbol || ''}${creationFee.toFixed(2)} ${selectedWalletCurrency?.code || submissionData?.paymentCurrency || 'USD'}`
                                        : 'Calcul en cours...'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="monpays-pin"
                                className="mb-2 block text-sm font-medium"
                            >
                                Code PIN
                            </label>

                            <input
                                ref={pinInputRef}
                                id="monpays-pin"
                                type="password"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={4}
                                value={pin}
                                onChange={(event) => {
                                    const value =
                                        event.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, 4);

                                    setPin(value);

                                    if (pinError) {
                                        setPinError('');
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' &&
                                        pin.length === 4 &&
                                        !isSubmitting
                                    ) {
                                        event.preventDefault();
                                        handlePinConfirm();
                                    }

                                    if (event.key === 'Escape') {
                                        closePinDialog();
                                    }
                                }}
                                className="h-12 w-full rounded-md border border-zinc-600 bg-zinc-800 px-4 text-center text-xl tracking-[0.5em] text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                placeholder="••••"
                                disabled={isSubmitting}
                            />

                            {pinError && (
                                <p className="mt-2 text-sm text-red-400">
                                    {pinError}
                                </p>
                            )}
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closePinDialog}
                                disabled={isSubmitting}
                                className="border-zinc-600 bg-transparent text-white hover:bg-zinc-800"
                            >
                                Annuler
                            </Button>

                            <Button
                                type="button"
                                onClick={handlePinConfirm}
                                disabled={
                                    isSubmitting ||
                                    pin.length !== 4
                                }
                                className="bg-red-600 text-white hover:bg-red-700"
                            >
                                {isSubmitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}

                                {isSubmitting
                                    ? 'Traitement...'
                                    : 'Payer et soumettre'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(
                        onSubmit,
                        (errors) => {
                            console.error(
                                '[CreateCompanyForm] Validation bloquée:',
                                errors
                            );
                        }
                    )}
                    className="space-y-6"
                >
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Nom de l'entreprise
                                </FormLabel>

                                <FormControl>
                                    <Input
                                        {...field}
                                        className="bg-zinc-700 border-zinc-600"
                                        autoComplete="organization"
                                    />
                                </FormControl>

                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Catégorie
                                </FormLabel>

                                <FormControl>
                                    <select
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        className="flex h-10 w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    >
                                        <option value="">
                                            Sélectionnez un domaine
                                        </option>

                                        {categories.map((category) => (
                                            <option
                                                key={category}
                                                value={category}
                                            >
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </FormControl>

                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Téléphone
                                    </FormLabel>

                                    <FormControl>
                                        <Input
                                            type="tel"
                                            {...field}
                                            className="bg-zinc-700 border-zinc-600"
                                            autoComplete="tel"
                                        />
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Email
                                    </FormLabel>

                                    <FormControl>
                                        <Input
                                            type="email"
                                            {...field}
                                            className="bg-zinc-700 border-zinc-600"
                                            autoComplete="email"
                                        />
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Site Web (Optionnel)
                                </FormLabel>

                                <FormControl>
                                    <Input
                                        type="url"
                                        {...field}
                                        className="bg-zinc-700 border-zinc-600"
                                        placeholder="https://exemple.com"
                                        autoComplete="url"
                                    />
                                </FormControl>

                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    Adresse complète
                                </FormLabel>

                                <FormControl>
                                    <Input
                                        {...field}
                                        className="bg-zinc-700 border-zinc-600"
                                        autoComplete="street-address"
                                    />
                                </FormControl>

                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="rccm"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        N° RCCM
                                    </FormLabel>

                                    <FormControl>
                                        <Input
                                            {...field}
                                            className="bg-zinc-700 border-zinc-600"
                                        />
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="nif"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        ID. NAT / NIF
                                    </FormLabel>

                                    <FormControl>
                                        <Input
                                            {...field}
                                            className="bg-zinc-700 border-zinc-600"
                                        />
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <FileUpload
                            label="Logo de l'entreprise"
                            preview={logoPreview}
                            onFileSelect={(event) =>
                                handleFileChange(
                                    event,
                                    setLogoPreview,
                                    'logoUrl'
                                )
                            }
                            onRemove={removeLogo}
                        />

                        <FileUpload
                            label="Bannière de l'entreprise"
                            preview={bannerPreview}
                            onFileSelect={(event) =>
                                handleFileChange(
                                    event,
                                    setBannerPreview,
                                    'bannerUrl'
                                )
                            }
                            onRemove={removeBanner}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="paymentCurrency"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>
                                    
Payer les frais de création
                                    {' '}
                                    {creationFee !== null
                                        ? `(${selectedWalletCurrency?.symbol || ''}${creationFee.toFixed(2)} ${selectedWalletCurrency?.code || selectedPaymentCurrency || ''})`
                                        : ''}
                                    {' '}
                                    avec
                                </FormLabel>

                                <FormControl>
                                    <RadioGroup
                                        value={field.value || ''}
                                        onValueChange={field.onChange}
                                        className="grid gap-3"
                                    >
                                        {walletCurrencies.map((currency) => (
                                            <label
                                                key={currency.code}
                                                htmlFor={`payment-currency-${currency.code}`}
                                                className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-600 bg-zinc-700 p-4 transition-colors hover:bg-zinc-600"
                                            >
                                                <RadioGroupItem
                                                    value={currency.code}
                                                    id={`payment-currency-${currency.code}`}
                                                />

                                                <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                                                    <div>
                                                        <div className="font-medium text-white">
                                                            {currency.code}
                                                        </div>
                                                        <div className="text-sm text-zinc-400">
                                                            {currency.name}
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="font-semibold text-white">
                                                            {currency.symbol}
                                        {parseCurrencyBalance(currency.balance).toFixed(2)}
                                                        </div>
                                                        <div className="text-xs text-zinc-400">
                                                            Solde disponible
                                                        </div>
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </RadioGroup>
                                </FormControl>

                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {isLoadingFee && (
                        <div className="flex items-center gap-2 rounded-md bg-zinc-800 p-3 text-sm text-zinc-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Calcul des frais de création...
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full bg-red-600 hover:bg-red-700"
                        disabled={isSubmitting}
                    >
                        {isSubmitting && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}

                        Soumettre pour vérification
                    </Button>
                </form>
            </Form>
        </>
    );
}
