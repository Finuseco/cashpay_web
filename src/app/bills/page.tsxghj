
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Receipt, AlertCircle, Droplets, Gauge, History, FileWarning, CheckCheck, Plus, Globe } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, RegidesoInvoice, RegidesoAbonnement, Country } from '@/lib/types';
import { getRegidesoInvoices, payRegidesoInvoices, submitRegidesoIndex, getUserAbonnements, addUserAbonnement } from '@/lib/actions/bills.actions';
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getCountriesList } from '@/lib/actions/countries.actions';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check as CheckIcon, ChevronsUpDown } from "lucide-react"
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';


const abonnementFormSchema = z.object({
  alias: z.string().min(2, { message: "L'alias doit contenir au moins 2 caractères." }),
  abonnementId: z.string().min(4, "Le numéro d'abonné est requis."),
});

const indexSchema = z.object({
  indexValue: z.coerce.number().positive("L'index doit être un nombre positif."),
});

const InvoiceTable = ({ invoices, onSelectionChange, t }: { invoices: RegidesoInvoice[], onSelectionChange: (selected: RegidesoInvoice[]) => void, t: any }) => {
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    const handleSelect = (invoiceNumber: string) => {
        const newSelection = new Set(selectedRows);
        if (newSelection.has(invoiceNumber)) {
            newSelection.delete(invoiceNumber);
        } else {
            newSelection.add(invoiceNumber);
        }
        setSelectedRows(newSelection);
        onSelectionChange(invoices.filter(inv => newSelection.has(inv.numero_facture)));
    };
    
    const handleSelectAll = (checked: boolean) => {
        const newSelection = checked ? new Set(invoices.map(inv => inv.numero_facture)) : new Set<string>();
        setSelectedRows(newSelection);
        onSelectionChange(invoices.filter(inv => newSelection.has(inv.numero_facture)));
    }
    
    const allSelected = selectedRows.size === invoices.length && invoices.length > 0;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-10"><Checkbox onCheckedChange={handleSelectAll} checked={allSelected}/></TableHead>
                    <TableHead>{t('monthColumn')}</TableHead>
                    <TableHead>{t('invoiceNumberColumn')}</TableHead>
                    <TableHead className="text-right">{t('amountCdfColumn')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invoices.map(invoice => (
                    <TableRow key={invoice.numero_facture} onClick={() => handleSelect(invoice.numero_facture)} className="cursor-pointer">
                        <TableCell><Checkbox checked={selectedRows.has(invoice.numero_facture)} /></TableCell>
                        <TableCell>{format(new Date(invoice.periode), 'MMMM yyyy', { locale: fr })}</TableCell>
                        <TableCell className="font-mono">{invoice.numero_facture}</TableCell>
                        <TableCell className="text-right font-semibold">{invoice.montant_ttc.toLocaleString()}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

const RegidesoService = ({ user, t }: { user: User, t: any }) => {
    const [abonnements, setAbonnements] = useState<RegidesoAbonnement[]>([]);
    const [activeAbonnementId, setActiveAbonnementId] = useState<string | null>(null);
    const [invoices, setInvoices] = useState<RegidesoInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    const { openAlert } = useAlertDialog();
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedInvoices, setSelectedInvoices] = useState<RegidesoInvoice[]>([]);
    
    const indexForm = useForm<z.infer<typeof indexSchema>>({
        resolver: zodResolver(indexSchema),
    });
    
    const abonnementForm = useForm<z.infer<typeof abonnementFormSchema>>({
      resolver: zodResolver(abonnementFormSchema),
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            const userAbonnements = await getUserAbonnements(user.id);
            setAbonnements(userAbonnements);
            if (userAbonnements.length > 0) {
                setActiveAbonnementId(userAbonnements[0].abonnement_id);
            } else {
                 setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [user.id]);

    const fetchInvoices = useCallback(async () => {
      if (!activeAbonnementId) return;
      setIsLoading(true);
      setInvoices([]);
      const result = await getRegidesoInvoices(activeAbonnementId);
      setIsLoading(false);
      if (result.success && result.invoices) {
        setInvoices(result.invoices);
      } else {
        openAlert({ variant: 'error', title: t('errorTitle'), description: result.error });
      }
    }, [activeAbonnementId, openAlert, t]);

    useEffect(() => {
        if (activeAbonnementId) {
          fetchInvoices();
        }
    }, [fetchInvoices, activeAbonnementId]);
    
    const handleAddAbonnement = async (values: z.infer<typeof abonnementFormSchema>) => {
      if(!user) return;
      const result = await addUserAbonnement(user.id, values);
      if (result.success) {
          setAbonnements(result.abonnements || []);
          setIsFormOpen(false);
          openAlert({variant: 'success', title: t('billsSubscriptionAddedTitle'), description: t('billsSubscriptionAddedDesc')});
      } else {
          openAlert({variant: 'error', title: t('errorTitle'), description: result.error});
      }
    }

    const unpaidInvoices = useMemo(() => invoices.filter(inv => inv.statut_facture === 'Impayée'), [invoices]);
    const totalDue = useMemo(() => unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.montant_ttc.toString().replace(/,/g, '')), 0), [unpaidInvoices]);

    const handlePaySelectedInvoices = async () => {
      if (!user || selectedInvoices.length === 0) return;
      setIsPaying(true);
      const result = await payRegidesoInvoices(user, selectedInvoices);
      setIsPaying(false);
      if (result.success) {
        openAlert({
          variant: 'success', title: t('paymentSuccessTitle'),
          description: t('paymentSuccessDesc', { count: selectedInvoices.length }),
          onClose: () => {
              fetchInvoices();
              setSelectedInvoices([]);
          }
        });
      } else {
        openAlert({ variant: 'error', title: t('paymentFailedTitle'), description: result.error });
      }
    };
    
    const handleIndexSubmit = async (values: z.infer<typeof indexSchema>) => {
        if (!user || !activeAbonnementId) return;
        const result = await submitRegidesoIndex(user.id, activeAbonnementId, values.indexValue);
         if (result.success) {
              openAlert({ variant: 'success', title: t('indexSubmittedTitle'), description: t('indexSubmittedDesc') });
              indexForm.reset();
         } else {
              openAlert({ variant: 'error', title: t('errorTitle'), description: result.error });
         }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Droplets /> {t('billsWaterRegideso')}</h2>
            <Card>
                <CardHeader>
                <CardTitle>{t('billsSelectSubscription')}</CardTitle>
                <div className="flex items-end gap-2 pt-2">
                    <div className="flex-grow">
                        <Select onValueChange={setActiveAbonnementId} value={activeAbonnementId || ''}>
                            <SelectTrigger disabled={abonnements.length === 0}><SelectValue placeholder={t('billsNoSubscriptionPlaceholder')} /></SelectTrigger>
                            <SelectContent>{abonnements.map(sub => <SelectItem key={sub.id} value={sub.abonnement_id}>{sub.alias} ({sub.abonnement_id})</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild><Button variant="outline" size="icon"><Plus className="h-4 w-4"/></Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>{t('billsAddNewSubscriptionTitle')}</DialogTitle></DialogHeader>
                            <Form {...abonnementForm}><form onSubmit={abonnementForm.handleSubmit(handleAddAbonnement)} className="space-y-4">
                                <FormField control={abonnementForm.control} name="alias" render={({field}) => (<FormItem><FormLabel>{t('billsAliasLabel')}</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)} />
                                <FormField control={abonnementForm.control} name="abonnementId" render={({field}) => (<FormItem><FormLabel>{t('billsSubscriberNumberLabel')}</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)} />
                                <Button type="submit">{t('billsSaveSubscriptionButton')}</Button>
                            </form></Form>
                        </DialogContent>
                    </Dialog>
                </div>
                </CardHeader>
            </Card>
            
            {isLoading ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /> : activeAbonnementId ? (
                <>
                <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{t('billsTotalDebt')}</CardTitle>
                            <FileWarning className="h-4 w-4 text-muted-foreground"/>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalDue.toLocaleString()} CDF</div>
                            <p className="text-xs text-muted-foreground">{t('billsUnpaidInvoicesCount', {count: unpaidInvoices.length})}</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{t('billsLastPaidInvoice')}</CardTitle>
                            <CheckCheck className="h-4 w-4 text-muted-foreground"/>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">18,500 CDF</div>
                            <p className="text-xs text-muted-foreground">{t('billsForMonth', {month: 'Avril 2024'})}</p>
                        </CardContent>
                    </Card>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>{t('billsUnpaidInvoices')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {unpaidInvoices.length > 0 ? (
                           <InvoiceTable invoices={unpaidInvoices} onSelectionChange={setSelectedInvoices} t={t} />
                        ) : (
                           <div className="text-center py-10 text-muted-foreground">{t('billsNoUnpaidInvoices')}</div>
                        )}
                    </CardContent>
                    {selectedInvoices.length > 0 && (
                        <CardFooter className="flex-col items-stretch gap-2 pt-4 border-t">
                            <div className="flex justify-between font-semibold">
                                <span>{t('billsPayTotalLabel')}</span>
                                <span>{selectedInvoices.reduce((sum, inv) => sum + parseFloat(inv.montant_ttc.toString().replace(/,/g, '')), 0).toLocaleString()} CDF</span>
                            </div>
                            <Button onClick={handlePaySelectedInvoices} disabled={isPaying} className="w-full">
                                {isPaying && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                {t('billsPayButton', {count: selectedInvoices.length})}
                            </Button>
                        </CardFooter>
                    )}
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Gauge/> {t('billsIndexSubmissionTitle')}</CardTitle>
                        <CardDescription>{t('billsIndexSubmissionDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Form {...indexForm}>
                            <form onSubmit={indexForm.handleSubmit(handleIndexSubmit)} className="flex items-end gap-2">
                                <FormField control={indexForm.control} name="indexValue" render={({ field }) => (
                                    <FormItem className="flex-grow">
                                        <FormLabel>{t('billsNewIndexLabel')}</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <Button type="submit">{t('billsSubmitButton')}</Button>
                            </form>
                         </Form>
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>{t('billsOtherActions')}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid sm:grid-cols-2 gap-4">
                         <Button variant="outline"><History className="mr-2 h-4 w-4"/> {t('billsPaymentHistory')}</Button>
                         <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"><AlertCircle className="mr-2 h-4 w-4"/> {t('billsReportProblem')}</Button>
                    </CardContent>
                </Card>
            </>
          ) : (
            <Card>
                 <CardContent className="pt-6 text-center text-muted-foreground">
                    <p>{t('billsAddSubscriptionPrompt')}</p>
                </CardContent>
            </Card>
          )}
        </div>
    );
};

// Main page component
export default function BillsPage() {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [countries, setCountries] = useState<Country[]>([]);
    const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            const [fetchedUser, fetchedCountries] = await Promise.all([
                getAuthenticatedUser(),
                getCountriesList(),
            ]);
            setUser(fetchedUser);
            setCountries(fetchedCountries);
            if (fetchedUser?.country) {
                const userCountry = fetchedCountries.find(c => c.name === fetchedUser.country);
                if (userCountry) {
                    setSelectedCountryCode(userCountry.code);
                }
            }
            setIsLoading(false);
        };
        fetchInitialData();
    }, []);
    
    const availableServices: { [key: string]: { component: React.FC<{ user: User, t: any }>, name: string }[] } = {
        'CD': [{ component: RegidesoService, name: 'Eau (REGIDESO)' }],
    };

    const servicesForCountry = selectedCountryCode ? availableServices[selectedCountryCode] || [] : [];
    const selectedCountry = countries.find(c => c.code === selectedCountryCode);

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5"/> {t('billsSelectCountry')}</CardTitle>
                            <CardDescription>{t('billsSelectCountryDesc')}</CardDescription>
                        </CardHeader>
                         <CardContent>
                            {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /> : (
                                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isPopoverOpen}
                                        className="w-full justify-between"
                                        >
                                        {selectedCountry ? (
                                            <div className="flex items-center gap-2">
                                                <Image src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`} width={20} height={15} alt={selectedCountry.name}/>
                                                <span>{selectedCountry.name}</span>
                                            </div>
                                        ) : "Choisissez un pays..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Rechercher un pays..." />
                                            <CommandList>
                                                <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
                                                <CommandGroup>
                                                {countries.map((country) => (
                                                    <CommandItem
                                                        key={country.code}
                                                        value={country.name}
                                                        onSelect={() => { setSelectedCountryCode(country.code); setIsPopoverOpen(false); }}
                                                    >
                                                    <CheckIcon className={cn("mr-2 h-4 w-4", selectedCountry?.code === country.code ? "opacity-100" : "opacity-0")} />
                                                    <div className="flex items-center gap-2">
                                                        <Image src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`} width={20} height={15} alt={country.name}/>
                                                        <span>{country.name}</span>
                                                    </div>
                                                    </CommandItem>
                                                ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </CardContent>
                    </Card>

                    {user && selectedCountryCode && (
                        servicesForCountry.length > 0 ? (
                            servicesForCountry.map((serviceInfo, index) => (
                                <div key={index}>
                                    <serviceInfo.component user={user} t={t} />
                                </div>
                            ))
                        ) : (
                            <Card>
                                <CardContent className="pt-6 text-center text-muted-foreground">
                                    <p>{t('billsNoServices')}</p>
                                </CardContent>
                            </Card>
                        )
                    )}
                </div>
            </main>
        </DashboardLayout>
    );
}


    