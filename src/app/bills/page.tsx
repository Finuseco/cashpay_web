
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
import { Loader2, Droplets, Gauge, Plus, Globe, Check as CheckIcon, ShieldCheck, FileWarning, CheckCheck } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, RegidesoInvoice, RegidesoAbonnement, Country } from '@/lib/types';
import { getRegidesoInvoices, payRegidesoInvoices, submitRegidesoIndex, getUserAbonnements, addUserAbonnement } from '@/lib/actions/bills.actions';
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getCountriesList } from '@/lib/actions/countries.actions';
import Image from 'next/image';
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

    const formatDateSafe = (dateStr: string) => {
        const d = new Date(dateStr);
        return isValid(d) ? format(d, 'MMMM yyyy', { locale: fr }) : dateStr;
    };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-10"><Checkbox onCheckedChange={handleSelectAll} checked={allSelected}/></TableHead>
                    <TableHead>{t('monthColumn', 'Mois')}</TableHead>
                    <TableHead>{t('invoiceNumberColumn', 'N° Facture')}</TableHead>
                    <TableHead className="text-right">{t('amountCdfColumn', 'Montant')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invoices.map(invoice => (
                    <TableRow key={invoice.numero_facture} onClick={() => handleSelect(invoice.numero_facture)} className="cursor-pointer">
                        <TableCell><Checkbox checked={selectedRows.has(invoice.numero_facture)} /></TableCell>
                        <TableCell>{formatDateSafe(invoice.periode)}</TableCell>
                        <TableCell className="font-mono">{invoice.numero_facture}</TableCell>
                        <TableCell className="text-right font-semibold">{(invoice.amount || invoice.montant_ttc || 0).toLocaleString()}</TableCell>
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
            try {
                const userAbonnements = await getUserAbonnements(user.id);
                setAbonnements(userAbonnements);
                if (userAbonnements.length > 0) {
                    setActiveAbonnementId(userAbonnements[0].abonnement_id);
                } else {
                    setIsLoading(false);
                }
            } catch (e) {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [user.id]);

    const fetchInvoices = useCallback(async () => {
      if (!activeAbonnementId) return;
      setIsLoading(true);
      try {
          const result = await getRegidesoInvoices(activeAbonnementId);
          if (result.success && result.invoices) {
            setInvoices(result.invoices);
          } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
          }
      } finally {
          setIsLoading(false);
      }
    }, [activeAbonnementId, openAlert]);

    useEffect(() => {
        if (activeAbonnementId) {
          fetchInvoices();
        }
    }, [fetchInvoices, activeAbonnementId]);
    
    const handleAddAbonnement = async (values: z.infer<typeof abonnementFormSchema>) => {
      const result = await addUserAbonnement(user.id, values);
      if (result.success) {
          setAbonnements(result.abonnements || []);
          setIsFormOpen(false);
          openAlert({variant: 'success', title: 'Abonnement ajouté', description: 'Votre numéro d\'abonné REGIDESO a été enregistré.'});
      } else {
          openAlert({variant: 'error', title: 'Erreur', description: result.error});
      }
    }

    const unpaidInvoices = useMemo(() => invoices.filter(inv => inv.statut_facture === 'Impayée'), [invoices]);
    const totalDue = useMemo(() => unpaidInvoices.reduce((sum, inv) => sum + (inv.amount || inv.montant_ttc || 0), 0), [unpaidInvoices]);

    const handlePaySelectedInvoices = async () => {
      if (selectedInvoices.length === 0) return;
      setIsPaying(true);
      const result = await payRegidesoInvoices(user, selectedInvoices);
      setIsPaying(false);
      if (result.success) {
        openAlert({
          variant: 'success', title: 'Paiement réussi',
          description: `${selectedInvoices.length} facture(s) payée(s).`,
          onClose: () => { fetchInvoices(); setSelectedInvoices([]); }
        });
      } else {
        openAlert({ variant: 'error', title: 'Échec du paiement', description: result.error });
      }
    };
    
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-primary"><Droplets /> EAU (REGIDESO)</h2>
            <Card className="border-none shadow-lg">
                <CardHeader>
                <CardTitle>Sélectionner un compte</CardTitle>
                <div className="flex items-end gap-2 pt-2">
                    <div className="flex-grow">
                        <Select onValueChange={setActiveAbonnementId} value={activeAbonnementId || ''}>
                            <SelectTrigger disabled={abonnements.length === 0} className="h-12"><SelectValue placeholder="Choisir un abonnement" /></SelectTrigger>
                            <SelectContent>{abonnements.map(sub => <SelectItem key={sub.id} value={sub.abonnement_id}>{sub.alias} ({sub.abonnement_id})</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setIsFormOpen(true)}><Plus className="h-5 w-5"/></Button>
                </div>
                </CardHeader>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nouveau Compte REGIDESO</DialogTitle></DialogHeader>
                    <Form {...abonnementForm}><form onSubmit={abonnementForm.handleSubmit(handleAddAbonnement)} className="space-y-4 pt-4">
                        <FormField control={abonnementForm.control} name="alias" render={({field}) => (<FormItem><FormLabel>Libellé (ex: Maison, Bureau)</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)} />
                        <FormField control={abonnementForm.control} name="abonnementId" render={({field}) => (<FormItem><FormLabel>Numéro d'Abonné</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)} />
                        <Button type="submit" className="w-full">Enregistrer le compte</Button>
                    </form></Form>
                </DialogContent>
            </Dialog>
            
            {isLoading ? <div className="py-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : activeAbonnementId ? (
                <>
                <div className="grid md:grid-cols-2 gap-4">
                    <Card className="bg-primary text-white border-none shadow-lg">
                        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-black tracking-widest opacity-70">Total à payer</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black">{totalDue.toLocaleString()} <span className="text-sm font-normal">CDF</span></div>
                            <p className="text-xs opacity-60 mt-1">{unpaidInvoices.length} facture(s) en attente</p>
                        </CardContent>
                    </Card>
                     <Card className="bg-zinc-800 text-white border-none shadow-lg">
                        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-black tracking-widest opacity-70">Dernier Index</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-black">---</div></CardContent>
                    </Card>
                </div>
                
                <Card className="border-none shadow-lg">
                    <CardHeader><CardTitle>Liste des Factures</CardTitle></CardHeader>
                    <CardContent>
                        {unpaidInvoices.length > 0 ? (
                           <InvoiceTable invoices={unpaidInvoices} onSelectionChange={setSelectedInvoices} t={t} />
                        ) : (
                           <div className="text-center py-16 text-muted-foreground italic">Aucune facture impayée trouvée.</div>
                        )}
                    </CardContent>
                    {selectedInvoices.length > 0 && (
                        <CardFooter className="flex-col items-stretch gap-3 pt-4 border-t bg-zinc-50 rounded-b-xl">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-sm font-bold">Sélection : {selectedInvoices.length} facture(s)</span>
                                <span className="text-xl font-black text-primary">{selectedInvoices.reduce((sum, inv) => sum + (inv.amount || inv.montant_ttc || 0), 0).toLocaleString()} CDF</span>
                            </div>
                            <Button onClick={handlePaySelectedInvoices} disabled={isPaying} className="w-full h-14 text-lg font-black shadow-lg" variant="gradient">
                                {isPaying ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <ShieldCheck className="mr-2"/>}
                                CONFIRMER LE PAIEMENT
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </>
          ) : null}
        </div>
    );
};

export default function BillsPage() {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [countries, setCountries] = useState<Country[]>([]);
    const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [fetchedUser, fetchedCountries] = await Promise.all([
                    getAuthenticatedUser(),
                    getCountriesList(),
                ]);
                setUser(fetchedUser);
                setCountries(fetchedCountries);
                if (fetchedUser?.country) {
                    const userCountry = fetchedCountries.find(c => c.name === fetchedUser.country);
                    if (userCountry) setSelectedCountryCode(userCountry.code);
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);
    
    if (isLoading) return <DashboardLayout><div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-12 w-12"/></div></DashboardLayout>;

    return (
        <DashboardLayout pageTitleKey="pageTitleBills">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="space-y-4">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground text-center block">Choisissez le pays du service</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {countries.map((country) => (
                                <button
                                    key={country.code}
                                    onClick={() => setSelectedCountryCode(country.code)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all h-24",
                                        selectedCountryCode === country.code 
                                            ? "border-primary bg-primary/5 text-primary shadow-md" 
                                            : "border-zinc-100 bg-white text-zinc-500 hover:bg-zinc-50"
                                    )}
                                >
                                    <Image src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} width={32} height={24} alt="" className="mb-2 shadow-sm rounded-sm" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-none">{country.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {user && selectedCountryCode === 'CD' ? (
                        <RegidesoService user={user} t={t} />
                    ) : selectedCountryCode ? (
                        <Card className="border-none shadow-lg text-center py-20 bg-zinc-50/50">
                            <CardContent>
                                <Globe className="h-16 w-16 mx-auto text-zinc-300 mb-4" />
                                <p className="text-muted-foreground">Aucun service de facturation disponible pour ce pays pour le moment.</p>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </main>
        </DashboardLayout>
    );
}
