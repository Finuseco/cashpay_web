
'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Eye, Receipt, Search, Calendar as CalendarIcon, Loader2, UserCheck, Gamepad2, ShoppingCart, Printer, Share2, RefreshCw } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import { useAlertDialog } from '@/hooks/use-alert-dialog';


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { PosReceipt } from "./pos-receipt";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

import { getCasinoHistory, getAgentSalesHistory } from '@/lib/actions/agent.actions';
import { verifyUser } from '@/ai/flows/verify-user-flow';
import type { CasinoTransaction, User } from "@/lib/types";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { checkMpesaTransactionStatus } from '@/lib/actions/transaction.actions';
import { useToast } from '@/hooks/use-toast';

const searchSchema = z.object({
  walletId: z.string().regex(/^[A-Z]{2}\d{10}$/, { message: "L'ID du portefeuille est invalide." }),
});

const salesFilterSchema = z.object({
    referenceCode: z.string().optional(),
    walletId: z.string().optional(),
    dateRange: z.object({
        from: z.date().optional(),
        to: z.date().optional(),
    }).optional(),
});


const SalesHistoryTab = () => {
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
    const receiptRef = React.useRef<HTMLDivElement>(null);
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();
    const [isCheckingStatus, setIsCheckingStatus] = useState<string | null>(null);


    const filterForm = useForm<z.infer<typeof salesFilterSchema>>({
        resolver: zodResolver(salesFilterSchema),
        defaultValues: {
            referenceCode: '',
            walletId: '',
            dateRange: {
                from: subDays(new Date(), 90), // Plage de 90 jours par défaut pour être sûr
                to: endOfDay(new Date()),
            }
        },
    });

    const fetchHistory = useCallback(async (filters: z.infer<typeof salesFilterSchema> = {}) => {
        setIsLoading(true);
        const user = await getAuthenticatedUser();
        if (user) {
            const result = await getAgentSalesHistory(user.id, {
                referenceCode: filters.referenceCode,
                walletId: filters.walletId,
                startDate: filters.dateRange?.from ? startOfDay(filters.dateRange.from) : undefined,
                endDate: filters.dateRange?.to ? endOfDay(filters.dateRange.to) : undefined,
            });
            if (result.success && result.data) {
                setHistory(result.data);
            }
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchHistory(filterForm.getValues());
    }, [fetchHistory, filterForm]);

    const handleFilterSubmit = (values: z.infer<typeof salesFilterSchema>) => {
        fetchHistory(values);
    };

    const handleReceiptClick = (sale: any) => {
        let parsedItems = [];
        if (sale.items) {
            if (typeof sale.items === 'string') {
                try {
                    parsedItems = JSON.parse(sale.items);
                } catch (e) {
                    console.error("Failed to parse items string", e);
                }
            } else if (Array.isArray(sale.items)) {
                parsedItems = sale.items;
            }
        }

        const receiptData = {
            ...sale,
            total: parseFloat(sale.total_amount || 0),
            tva: parseFloat(sale.transaction_metadata?.vat_amount || 0),
            items: parsedItems,
            buyerName: sale.buyerName
        };
        setSelectedReceipt(receiptData);
    };
    
    const handlePrint = () => window.print();

    const handleSharePdf = async () => {
        const element = receiptRef.current;
        if (!element) return;

        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: [80, 150]
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`recu-cashpay-${selectedReceipt?.reference}.pdf`);
        } catch (error) {
            console.error("Erreur lors de la génération du PDF:", error);
            openAlert({
                title: "Erreur PDF",
                description: "Une erreur est survenue lors de la création du PDF.",
                variant: "error"
            });
        }
    };
    
    const handleCheckStatus = async (reference: string) => {
        setIsCheckingStatus(reference);
        toast({ title: 'Vérification en cours...', description: `Demande de statut pour la transaction ${reference}.` });
        const result = await checkMpesaTransactionStatus(reference);
        if(result.success) {
            toast({ title: 'Statut demandé', description: result.message, variant: 'success' });
            setTimeout(() => fetchHistory(filterForm.getValues()), 5000);
        } else {
            toast({ title: 'Erreur', description: result.message, variant: 'destructive' });
        }
        setIsCheckingStatus(null);
    }


    return (
        <>
             <style>
                {`
                @media print {
                    body > *:not(#printable-receipt-dialog) {
                        visibility: hidden;
                    }
                    #printable-receipt-dialog, #printable-receipt-dialog * {
                        visibility: visible;
                    }
                    #printable-receipt-dialog {
                        position: absolute;
                        left: 0;
                        top: 0;
                    }
                     @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                }
                `}
            </style>

            <Card className="border-t-0 rounded-t-none">
                 <CardContent className="pt-6">
                    <Form {...filterForm}>
                        <form onSubmit={filterForm.handleSubmit(handleFilterSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <FormField control={filterForm.control} name="referenceCode" render={({ field }) => ( <FormItem><FormControl><Input placeholder="Filtrer par référence..." {...field} /></FormControl></FormItem> )}/>
                            <FormField control={filterForm.control} name="walletId" render={({ field }) => ( <FormItem><FormControl><Input placeholder="Filtrer par ID Client..." {...field} /></FormControl></FormItem> )}/>
                            <FormField
                                control={filterForm.control}
                                name="dateRange"
                                render={({ field }) => (
                                    <FormItem>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value?.from && "text-muted-foreground")}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value?.from ? (field.value.to ? <>{format(field.value.from, "LLL dd, y")} - {format(field.value.to, "LLL dd, y")}</> : format(field.value.from, "LLL dd, y")) : <span>Filtrer par date</span>}
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar initialFocus mode="range" defaultMonth={field.value?.from} selected={field.value as DateRange | undefined} onSelect={field.onChange} numberOfMonths={2}/>
                                            </PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Rechercher"}</Button>
                        </form>
                    </Form>
                 </CardContent>
            </Card>

            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Ventes de Produits Récentes</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Référence</TableHead><TableHead>Client</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                            ) : history.length > 0 ? history.map((sale, index) => (
                            <TableRow key={`${sale.reference}-${index}`}>
                                <TableCell>{new Date(sale.date).toLocaleString('fr-FR')}</TableCell>
                                <TableCell className="font-mono text-xs">{sale.reference}</TableCell>
                                <TableCell className="text-sm">{sale.buyerName || 'N/A'}</TableCell>
                                <TableCell>
                                    <Badge variant={sale.transaction_status === 'Completed' ? 'default' : 'secondary'} className={cn(sale.transaction_status === 'Completed' ? 'bg-green-500' : 'bg-yellow-500')}>
                                        {sale.transaction_status || 'N/A'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-bold">${parseFloat(sale.total_amount).toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex gap-1 justify-end">
                                        <Button variant="ghost" size="icon" onClick={() => handleReceiptClick(sale)} title="Voir le reçu"><Eye className="h-4 w-4" /></Button>
                                        {sale.transaction_status === 'Pending' && (sale.transaction_metadata?.provider === 'M-Pesa') && (
                                            <Button variant="ghost" size="icon" onClick={() => handleCheckStatus(sale.reference)} disabled={isCheckingStatus === sale.reference}>
                                                {isCheckingStatus === sale.reference ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4 text-blue-500" />}
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune vente enregistrée.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!selectedReceipt} onOpenChange={(isOpen) => !isOpen && setSelectedReceipt(null)}>
                <DialogContent className="max-w-sm p-0 border-none bg-transparent shadow-none" id="printable-receipt-dialog">
                     <div ref={receiptRef}>
                        {selectedReceipt && <PosReceipt {...selectedReceipt} />}
                     </div>
                     <DialogFooter className="sm:justify-between gap-2 p-4 pt-0 bg-background rounded-b-lg print:hidden">
                        <Button variant="outline" onClick={handlePrint} className="w-full">
                            <Printer className="mr-2 h-4 w-4" /> Imprimer
                        </Button>
                        <Button variant="secondary" onClick={handleSharePdf} className="w-full">
                           <Share2 className="mr-2 h-4 w-4" /> Partager en PDF
                        </Button>
                     </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

const GameHistoryTab = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [transactions, setTransactions] = useState<CasinoTransaction[]>([]);
    const [verifiedClient, setVerifiedClient] = useState<{name: string, id: string} | null>(null);
    const [date, setDate] = useState<DateRange | undefined>({ from: new Date(new Date().setDate(new Date().getDate() - 30)), to: new Date() });

    const searchForm = useForm<z.infer<typeof searchSchema>>({
        resolver: zodResolver(searchSchema),
        defaultValues: { walletId: '' },
    });

    const handleSearch = async (values: z.infer<typeof searchSchema>) => {
        if (!date?.from || !date?.to) return;
        setIsLoading(true);
        setTransactions([]);
        setSearched(true);
        setVerifiedClient(null);

        const verification = await verifyUser({ walletId: values.walletId });
        if (!verification.isValid || !verification.userName) {
            searchForm.setError('walletId', { type: 'manual', message: 'Client non trouvé.' });
            setIsLoading(false);
            return;
        }

        setVerifiedClient({ name: verification.userName, id: values.walletId });
        const result = await getCasinoHistory(values.walletId, { from: date.from, to: date.to });
        
        if (result.success && result.data) setTransactions(result.data);
        setIsLoading(false);
    };

    return (
        <div className="space-y-4 pt-6">
            <Form {...searchForm}>
                <form onSubmit={searchForm.handleSubmit(handleSearch)} className="flex flex-col sm:flex-row gap-4 px-6">
                    <FormField control={searchForm.control} name="walletId" render={({ field }) => ( <FormItem className="flex-grow"> <FormControl><Input placeholder="ID Portefeuille du Client..." {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                    <FormItem className="flex flex-col">
                        <Popover><PopoverTrigger asChild>
                            <Button id="date" variant="outline" className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (date.to ? <>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</> : format(date.from, "LLL dd, y")) : <span>Choisissez une date</span>}
                            </Button>
                        </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/></PopoverContent></Popover>
                    </FormItem>
                    <Button type="submit" disabled={isLoading} className="self-end h-10">{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />} Rechercher</Button>
                </form>
            </Form>
            {verifiedClient && <div className="mx-6 p-2 bg-green-50 text-green-800 rounded-md flex items-center gap-2 text-sm font-semibold"><UserCheck className="h-4 w-4"/> Affichage des résultats pour {verifiedClient.name} ({verifiedClient.id})</div>}
            
            {isLoading ? <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div> :
             searched && transactions.length > 0 ? (
                <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {transactions.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell>{format(new Date(tx.timestamp), 'dd/MM/yy HH:mm', { locale: fr })}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell><Badge variant="outline">{tx.tx_type}</Badge></TableCell>
                                <TableCell className={cn('text-right font-semibold', tx.tx_type === 'win' || tx.tx_type === 'deposit' ? 'text-green-500' : 'text-red-500')}>
                                    {tx.tx_type === 'win' || tx.tx_type === 'deposit' ? '+' : '-'} {tx.amount.toLocaleString()} {tx.currency}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : searched ? <div className="text-center py-10 text-muted-foreground">Aucune transaction de jeu trouvée pour ce client dans cette période.</div> : null}
        </div>
    );
};

export function HistoryClient() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Historique</h1>
      <p className="text-muted-foreground">Consultez l'historique des ventes de produits et des transactions de jeu des clients.</p>
    
      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sales"><ShoppingCart className="mr-2 h-4 w-4"/>Historique des Ventes</TabsTrigger>
            <TabsTrigger value="gaming"><Gamepad2 className="mr-2 h-4 w-4"/>Historique de Jeu (Client)</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
            <SalesHistoryTab />
        </TabsContent>
        <TabsContent value="gaming">
             <Card className="border-t-0 rounded-t-none">
                <GameHistoryTab />
             </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
