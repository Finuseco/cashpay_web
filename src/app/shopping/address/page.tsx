
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Home, Trash2, Edit, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserAddresses, addOrUpdateUserAddress, deleteUserAddress } from '@/lib/actions/address.actions';
import { countries } from '@/lib/countries';
import { PROVINCES_BY_COUNTRY } from '@/lib/provinces';
import type { User, Address } from '@/lib/types';
import { useTranslation } from 'react-i18next';


const addressSchema = z.object({
    label: z.string().min(1, 'Le label est requis.'),
    fullName: z.string().min(1, 'Le nom complet est requis.'),
    phone: z.string().min(9, 'Le numéro de téléphone est requis.'),
    countryCode: z.string({ required_error: 'Veuillez sélectionner un pays.' }),
    province: z.string({ required_error: 'Veuillez sélectionner une province.' }),
    city: z.string().min(2, 'La ville est requise.'),
    address: z.string().min(10, 'L\'adresse complète est requise.'),
});

const AddressForm = ({ onSave, initialData, closeDialog, userCountryCode }: { onSave: (data: Partial<Address>) => Promise<void>, initialData?: Address | null, closeDialog: () => void, userCountryCode: string }) => {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof addressSchema>>({
        resolver: zodResolver(addressSchema),
        defaultValues: initialData || { label: 'Domicile', fullName: '', phone: '', address: '', city: '', province: '', countryCode: userCountryCode },
    });
    
    const selectedCountry = form.watch('countryCode');

    useEffect(() => {
        if (!initialData) {
            form.setValue('province', '');
        }
    }, [selectedCountry, form, initialData]);

    const handleSubmit = async (values: z.infer<typeof addressSchema>) => {
        setIsSubmitting(true);
        await onSave({
            id: initialData?.id,
            ...values
        });
        setIsSubmitting(false);
        closeDialog();
    };
    
    const provincesForSelectedCountry = PROVINCES_BY_COUNTRY[selectedCountry as keyof typeof PROVINCES_BY_COUNTRY] || [];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="label" render={({ field }) => ( <FormItem><FormLabel>{t('addressFormLabel', 'Label (ex: Domicile, Bureau)')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="fullName" render={({ field }) => ( <FormItem><FormLabel>{t('addressFormFullName', 'Nom complet du destinataire')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>{t('addressFormPhone', 'Téléphone')}</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('addressFormCountry', 'Pays')}</FormLabel>
                            <FormControl>
                                <div
                                    role="radiogroup"
                                    aria-label={t('addressFormCountry', 'Pays')}
                                    className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto rounded-lg border p-2"
                                >
                                    {countries.map((country) => (
                                        <label
                                            key={country.code}
                                            className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors ${field.value === country.code ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
                                        >
                                            <input
                                                type="radio"
                                                name={field.name}
                                                value={country.code}
                                                checked={field.value === country.code}
                                                onChange={() => field.onChange(country.code)}
                                                className="h-4 w-4 accent-primary shrink-0"
                                            />
                                            <span className="truncate">{country.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {selectedCountry && provincesForSelectedCountry.length > 0 && (
                    <FormField
                        control={form.control}
                        name="province"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('addressFormProvince', 'Province/État')}</FormLabel>
                                <FormControl>
                                    <div
                                        role="radiogroup"
                                        aria-label={t('addressFormProvince', 'Province/État')}
                                        className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto rounded-lg border p-2"
                                    >
                                        {provincesForSelectedCountry.map((province) => (
                                            <label
                                                key={province}
                                                className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors ${field.value === province ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={field.name}
                                                    value={province}
                                                    checked={field.value === province}
                                                    onChange={() => field.onChange(province)}
                                                    className="h-4 w-4 accent-primary shrink-0"
                                                />
                                                <span className="truncate">{province}</span>
                                            </label>
                                        ))}
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>{t('addressFormCity', 'Ville')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>{t('addressFormFullAddress', 'Adresse complète')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {initialData ? t('addressFormUpdate', 'Mettre à jour') : t('addressFormSave', 'Sauvegarder')}
                </Button>
            </form>
        </Form>
    );
};


export default function AddressPage() {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const { openAlert } = useAlertDialog();

    const fetchUserAndAddresses = useCallback(async () => {
        setIsLoading(true);
        const fetchedUser = await getAuthenticatedUser();
        if (fetchedUser) {
            setUser(fetchedUser);
            const savedAddresses = await getUserAddresses(fetchedUser.id);
            setAddresses(savedAddresses);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchUserAndAddresses();
    }, [fetchUserAndAddresses]);

    const handleSave = async (data: Partial<Address>) => {
        if (!user) return;
        const result = await addOrUpdateUserAddress(user.id, data);
        if (result.success && result.addresses) {
            setAddresses(result.addresses);
        } else {
            openAlert({ title: "Erreur", description: result.error || "Échec de l'enregistrement de l'adresse.", variant: 'error' });
        }
    };

    const handleDelete = (id: string) => {
        if (!user) return;
        openAlert({
            title: t('addressDeleteConfirmTitle', 'Supprimer cette adresse ?'),
            description: t('addressDeleteConfirmDescription', 'Cette action est irréversible.'),
            variant: 'warning',
            onClose: async (confirmed) => {
                if (confirmed) {
                    const result = await deleteUserAddress(user.id, id);
                    if (result.success && result.addresses) {
                        setAddresses(result.addresses);
                    }
                }
            },
        })
    };
    
    const handleOpenDialog = (address: Address | null = null) => {
        setEditingAddress(address);
        setIsFormOpen(true);
    };

    return (
        <div className="p-4 space-y-4 max-w-4xl mx-auto">
            <h1 className="text-xl font-bold">{t('addressTitle', 'Mes Adresses')}</h1>
            
            {isLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
            ) : addresses.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground bg-background border rounded-lg border-dashed">
                    <Home className="mx-auto h-12 w-12 opacity-20 mb-2" />
                    <p>{t('addressEmpty', 'Aucune adresse enregistrée.')}</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {addresses.map((addr: Address) => (
                        <div key={addr.id} className="border bg-card p-4 rounded-lg flex items-start gap-4 shadow-sm">
                             <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                                <Home className="h-5 w-5 text-primary" />
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="font-bold truncate">{addr.label} <span className="text-muted-foreground font-normal text-xs">({addr.fullName})</span></p>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{addr.address}, {addr.city}</p>
                                <p className="text-xs text-muted-foreground">{addr.province}, {countries.find(c=>c.code === addr.countryCode)?.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">{addr.phone}</p>
                             </div>
                             <div className="flex flex-col gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(addr)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(addr.id)}><Trash2 className="h-4 w-4"/></Button>
                             </div>
                        </div>
                    ))}
                </div>
            )}
            
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                 <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y">
                    <DialogHeader>
                        <DialogTitle>{editingAddress ? t('addressDialogEditTitle', 'Modifier l\'adresse') : t('addressDialogNewTitle', 'Nouvelle Adresse')}</DialogTitle>
                        <DialogDescription>{t('addressDialogDescription', 'Remplissez les informations ci-dessous.')}</DialogDescription>
                    </DialogHeader>
                    {user && <AddressForm onSave={handleSave} initialData={editingAddress} closeDialog={() => setIsFormOpen(false)} userCountryCode={user.country || 'CD'} />}
                 </DialogContent>
            </Dialog>

             <div className="fixed bottom-20 left-4 right-4 md:relative md:bottom-0 md:left-0 md:right-0">
                <Button className="w-full h-12 text-lg shadow-lg md:shadow-none" onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-5 w-5" />
                    {t('addressAddNewButton', 'Ajouter une nouvelle adresse')}
                </Button>
            </div>
        </div>
    );
}
