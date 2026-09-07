
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import { 
    Usb, Lock, Unlock, Upload, Search, ShieldCheck, History, 
    Download, XCircle, Loader2, Info, FileText, FileArchive, 
    MoreHorizontal, PlusCircle, Shield, Wallet, KeyRound, Check
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { 
    signTransactionWithHardwareKey, 
    recoverSignedBalance, 
    getHardwareSignatures, 
    cancelHardwareSignature, 
    extractSignatureFromCpk,
    updateHardwareKeyPin
} from '@/lib/actions/security.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
    Form, FormControl, FormField, FormItem, FormLabel, 
    FormMessage, FormDescription 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn, countryToCode, getCountryByCode } from '@/lib/utils';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import type { User } from '@/lib/types';

const signSchema = z.object({
    amount: z.coerce.number().positive("Montant requis."),
    currency: z.string().min(1, "Devise requise."),
    securityLevel: z.enum(['none', 'pin_protected']),
    keyPin: z.string().optional(),
}).refine(data => data.securityLevel === 'none' || (data.keyPin && data.keyPin.length === 4), {
    message: "Le PIN de la clé est requis.",
    path: ["keyPin"]
});

const pinSchema = z.object({
    pin: z.string().length(4, "PIN requis."),
});

export default function CpkAppPage() {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [signatures, setSignatures] = useState<any[]>([]);
    
    // UI States
    const [isPinOpen, setIsPinOpen] = useState(false);
    const [isCancelPinOpen, setIsCancelPinOpen] = useState(false);
    const [selectedSigForAction, setSelectedSigForAction] = useState<any | null>(null);
    const [searchSignature, setSearchSignature] = useState('');
    const [recoveryPin, setRecoveryPin] = useState('');
    const [fee, setFee] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const signForm = useForm<z.infer<typeof signSchema>>({
        resolver: zodResolver(signSchema),
        defaultValues: { amount: 0, securityLevel: 'none', currency: 'USD' }
    });

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
        defaultValues: { pin: "" }
    });

    const watchedAmount = signForm.watch('amount');
    const watchedCurrency = signForm.watch('currency');
    const watchedSecurity = signForm.watch('securityLevel');

    const fetchData = useCallback(async () => {
        try {
            const current = await getAuthenticatedUser();
            if (current) {
                setUser(current);
                const sigs = await getHardwareSignatures(current.id);
                setSignatures(sigs);
            }
        } catch (e) {
            console.error("Failed to fetch CPK data:", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setIsClient(true);
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const updateFee = async () => {
            if (watchedAmount > 0 && watchedCurrency && user && isClient) {
                try {
                    const calculatedFee = await calculateTransactionFee(watchedAmount, watchedCurrency, 'HSM_LOCK', user.country);
                    setFee(calculatedFee);
                } catch (e) { setFee(0); }
            }
        };
        if (isClient) updateFee();
    }, [watchedAmount, watchedCurrency, user, isClient]);

    const handlePinSubmit = async (values: z.infer<typeof pinSchema>) => {
        if (!user) return;
        const signData = signForm.getValues();
        setIsProcessing(true);
        try {
            const result = await signTransactionWithHardwareKey({
                amount: Number(signData.amount),
                currency: signData.currency,
                securityLevel: signData.securityLevel as 'none' | 'pin_protected',
                keyPin: signData.keyPin,
                userPin: values.pin
            });

            if (result.success) {
                const zip = new JSZip();
                zip.file(`CERTIFICAT_HSM_${result.signature.substring(0,8)}.cpk`, result.fileContent);
                const blob = await zip.generateAsync({ type: "blob" });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `CashPay_USB_Package.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                openAlert({ title: "Archive Générée", description: "Votre certificat a été téléchargé.", variant: 'success' });
                signForm.reset();
                fetchData();
            } else {
                openAlert({ title: "Échec", description: result.error || "Une erreur est survenue.", variant: 'error'});
            }
        } finally {
            setIsProcessing(false);
            setIsPinOpen(false);
            pinForm.reset();
        }
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            const extraction = await extractSignatureFromCpk(content);
            if (extraction.success && extraction.signature) {
                setSearchSignature(extraction.signature);
                toast({ title: "Clé Détectée", description: "La signature du fichier est valide." });
            } else {
                openAlert({ title: "Échec de l'importation", description: extraction.error || "Fichier invalide.", variant: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const handleRecover = async () => {
        if (!searchSignature) return;
        setIsProcessing(true);
        try {
            const result = await recoverSignedBalance({
                signature: searchSignature,
                keyPin: recoveryPin
            });

            if (result.success) {
                openAlert({ title: "Fonds Encaissés", description: `Le montant a été crédité sur votre compte.`, variant: 'success' });
                setSearchSignature('');
                setRecoveryPin('');
                fetchData();
            } else {
                openAlert({ title: "Erreur", description: result.error, variant: 'error' });
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelClick = (ref: string) => {
        setSelectedSigForAction({ reference: ref });
        setIsCancelPinOpen(true);
    };

    if (!isClient) return null;

    return (
        <DashboardLayout pageTitleKey="CPK Sovereignty">
            <main className="max-w-4xl mx-auto p-4 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <Usb className="h-10 w-10 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Sovereign Vault</h1>
                            <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest">CPK Engine v2.2</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="h-7 border-primary/30 text-primary px-3">
                        <ShieldCheck className="mr-1.5 h-4 w-4"/> Registre HSM Actif
                    </Badge>
                </div>

                <Tabs defaultValue="issue" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 h-12">
                        <TabsTrigger value="issue">Émission</TabsTrigger>
                        <TabsTrigger value="recover">Récupération</TabsTrigger>
                        <TabsTrigger value="history">Historique</TabsTrigger>
                    </TabsList>

                    <TabsContent value="issue" className="pt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Nouveau Certificat de Valeur</CardTitle>
                                <CardDescription>Transformez votre solde digital en instrument au porteur exportable.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...signForm}>
                                    <form onSubmit={signForm.handleSubmit(() => setIsPinOpen(true))} className="space-y-6">
                                        <div className="space-y-4">
                                            <FormField control={signForm.control} name="currency" render={({field}) => (
                                                <FormItem className="space-y-3">
                                                    <FormLabel>Source de financement</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-2">
                                                            {['USD', 'EUR', 'CDF'].map(cur => (
                                                                <div key={cur}>
                                                                    <RadioGroupItem value={cur} id={`c-${cur}`} className="sr-only" />
                                                                    <Label htmlFor={`c-${cur}`} className={cn("flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary", field.value === cur ? "border-primary bg-primary/5 font-bold" : "border-zinc-100")}>{cur}</Label>
                                                                </div>
                                                            ))}
                                                        </RadioGroup>
                                                    </FormControl>
                                                </FormItem>
                                            )}/>

                                            <FormField control={signForm.control} name="amount" render={({field}) => (
                                                <FormItem><FormLabel>Montant facial</FormLabel><FormControl><Input type="number" step="any" placeholder="0.00" {...field} className="h-14 text-2xl font-black text-center"/></FormControl></FormItem>
                                            )}/>
                                        </div>

                                        <FormField control={signForm.control} name="securityLevel" render={({field}) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel>Protection de la clé</FormLabel>
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="l-none" /><Label htmlFor="l-none">Libre (Porteur)</Label></div>
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="pin_protected" id="l-pin" /><Label htmlFor="l-pin">Protégé (PIN)</Label></div>
                                                    </RadioGroup>
                                                </FormControl>
                                            </FormItem>
                                        )}/>

                                        {watchedSecurity === 'pin_protected' && (
                                            <FormField control={signForm.control} name="keyPin" render={({field}) => (
                                                <FormItem>
                                                    <FormLabel>Définir le PIN du certificat (4 chiffres)</FormLabel>
                                                    <FormControl><Input type="password" maxLength={4} placeholder="****" {...field} className="h-12 text-center text-lg tracking-widest"/></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        )}

                                        <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-bold" disabled={!watchedAmount || watchedAmount <= 0}>
                                            GÉNÉRER L'ARCHIVE .CPK
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="recover" className="pt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Encaisser un Certificat</CardTitle>
                                <CardDescription>Libérez la valeur d'une clé matérielle vers votre portefeuille digital.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/5 transition-all border-zinc-200">
                                    <Upload className="h-10 w-10 text-muted-foreground" />
                                    <p className="font-bold">Importer Fichier .cpk</p>
                                    <input ref={fileInputRef} type="file" accept=".cpk" className="hidden" onChange={handleFileImport} />
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Signature H (Clé de registre)</Label>
                                        <Input placeholder="Collez la signature..." value={searchSignature} onChange={e => setSearchSignature(e.target.value)} className="h-12 font-mono text-xs"/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Code PIN de la clé (si applicable)</Label>
                                        <Input type="password" placeholder="****" value={recoveryPin} onChange={e => setRecoveryPin(e.target.value)} className="h-12 text-center tracking-widest"/>
                                    </div>
                                </div>

                                <Button className="w-full h-14 text-lg font-black" onClick={handleRecover} disabled={!searchSignature || isProcessing}>
                                    TOUT ENCAISSER MAINTENANT
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="history" className="pt-6">
                        <Card>
                            <CardHeader><CardTitle>Registre des Valeurs Émises</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableBody>
                                        {signatures.map(sig => (
                                            <TableRow key={sig.reference} className="hover:bg-muted/30">
                                                <TableCell className="text-xs">
                                                    <p className="font-bold">{sig.reference}</p>
                                                    <p className="text-muted-foreground">{sig.date}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-bold">{sig.amount.toFixed(2)} {sig.currency}</p>
                                                    <Badge variant="outline" className="text-[10px]">{sig.security_level === 'none' ? 'LIBRE' : 'PROTÉGÉ'}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn(
                                                        "text-[10px] font-black uppercase",
                                                        sig.status === 'active' ? "bg-green-500" : "bg-zinc-500"
                                                    )}>
                                                        {sig.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {sig.status === 'active' && (
                                                        <Button variant="ghost" size="icon" onClick={() => handleCancelClick(sig.reference)} className="text-destructive">
                                                            <XCircle className="h-5 w-5"/>
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {signatures.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">Aucun certificat émis.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>

            <Dialog open={isPinOpen} onOpenChange={setIsPinOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-xs">
                    <DialogHeader><DialogTitle>Validation Signature</DialogTitle></DialogHeader>
                    <Form {...pinForm}>
                        <form onSubmit={pinForm.handleSubmit(handlePinSubmit)} className="space-y-6 pt-4 text-center">
                            <p className="text-xs text-zinc-400 uppercase font-bold">Total à débiter :</p>
                            <p className="text-2xl font-black">{(Number(watchedAmount || 0) + fee).toFixed(2)} {watchedCurrency}</p>
                            <FormField control={pinForm.control} name="pin" render={({field}) => (
                                <FormItem><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                            )}/>
                            <Button type="submit" variant="gradient" className="w-full h-12" disabled={isProcessing}>
                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} SIGNER ET GÉNÉRER
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
