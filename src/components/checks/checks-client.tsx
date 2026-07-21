
'use client';

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import type { User, DigitalCheck } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { createDigitalCheck } from '@/lib/actions/check.actions';
import { cn } from '@/lib/utils';
import { PlusCircle, Loader2, CalendarIcon, Eye, Printer, Send } from 'lucide-react';
import { DigitalCheckView } from './digital-check-view';

const checkFormSchema = z.object({
    recipientName: z.string().min(3, "Le nom du bénéficiaire est requis."),
    amount: z.coerce.number().positive("Le montant doit être un nombre positif."),
    currency: z.string({ required_error: "Veuillez sélectionner une devise."}),
    issueDate: z.date({ required_error: "La date d'émission est requise." }),
});

export function ChecksClient({ user, initialChecks }: { user: User, initialChecks: DigitalCheck[] }) {
    const [checks, setChecks] = useState<DigitalCheck[]>(initialChecks);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedCheck, setSelectedCheck] = useState<DigitalCheck | null>(null);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof checkFormSchema>>({
        resolver: zodResolver(checkFormSchema),
        defaultValues: { 
            issueDate: new Date(), 
            currency: 'USD',
            recipientName: '',
            amount: undefined, // Set to undefined for numeric inputs to be empty initially
        }
    });

    const handleFormSubmit = async (values: z.infer<typeof checkFormSchema>) => {
        setIsSubmitting(true);
        const result = await createDigitalCheck({ ...values, user });
        if (result.success && result.check) {
            setChecks(prev => [result.check!, ...prev]);
            setIsFormOpen(false);
            form.reset({ issueDate: new Date(), currency: 'USD', recipientName: '', amount: undefined });
            openAlert({
                title: 'Chèque Émis',
                description: `Le chèque numérique pour ${values.recipientName} a été créé avec succès.`,
                variant: 'success'
            });
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
        setIsSubmitting(false);
    }
    
    const getStatusVariant = (status: DigitalCheck['status']) => {
        switch(status) {
            case 'valid': return 'default';
            case 'cashed': return 'secondary';
            case 'cancelled': return 'destructive';
            case 'expired': return 'outline';
            default: return 'secondary';
        }
    }

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Chèques Numériques</h1>
                        <p className="text-muted-foreground">Émettez et gérez vos chèques de manière sécurisée.</p>
                    </div>
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" /> Émettre un chèque
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Émettre un nouveau chèque numérique</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 pt-4">
                                     <FormField control={form.control} name="recipientName" render={({ field }) => ( <FormItem><FormLabel>Nom du Bénéficiaire</FormLabel><FormControl><Input placeholder="Ex: John Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <div className="grid grid-cols-2 gap-4">
                                         <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                         <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="CDF">CDF</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                    </div>
                                    <FormField control={form.control} name="issueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date d'émission</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal",!field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : <span>Choisir une date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                                    <Button type="submit" disabled={isSubmitting} className="w-full">
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Émettre le chèque
                                    </Button>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Mes Chèques Émis</CardTitle>
                        <CardDescription>Liste de tous les chèques numériques que vous avez créés.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Numéro</TableHead>
                                    <TableHead>Bénéficiaire</TableHead>
                                    <TableHead>Montant</TableHead>
                                    <TableHead className="text-center">Statut</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {checks.length > 0 ? checks.map(check => (
                                    <TableRow key={check.id}>
                                        <TableCell className="font-mono text-xs">{check.checkNumber}</TableCell>
                                        <TableCell className="font-medium">{check.recipientName}</TableCell>
                                        <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: check.currency }).format(check.amount)}</TableCell>
                                        <TableCell className="text-center"><Badge variant={getStatusVariant(check.status)}>{check.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => setSelectedCheck(check)}><Eye className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Aucun chèque trouvé.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
             <Dialog open={!!selectedCheck} onOpenChange={(isOpen) => !isOpen && setSelectedCheck(null)}>
                <DialogContent className="max-w-md">
                   {selectedCheck && <DigitalCheckView check={selectedCheck} issuer={user} />}
                   <DialogFooter className="sm:justify-start gap-2 mt-4">
                        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/> Imprimer</Button>
                        <Button><Send className="mr-2 h-4 w-4"/> Partager</Button>
                   </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
