'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import { 
    Usb, Lock, Unlock, Upload, Search, ShieldCheck, History, 
    Download, XCircle, Loader2, Info, FileText, FileArchive, 
    MoreHorizontal, PlusCircle, Shield, Wallet, KeyRound
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn, countryToCode, getCountryByCode } from '@/lib/utils';
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import JSZip from 'jszip';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

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

const updatePinSchema = z.object({
    oldPin: z.string().optional(),
    newPin: z.string().length(4, "Le nouveau PIN doit comporter 4 chiffres."),
});

export default function CpkAppPage() {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [signatures, setSignatures] = useState<any[]>([]);
    
    // States
    const [isPinOpen, setIsPinOpen] = useState(false);
    const [isCancelPinOpen, setIsCancelPinOpen] = useState(false);
    const [isUpdatePinOpen, setIsUpdatePinOpen] = useState(false);
    const [selectedSigForAction, setSelectedSigForAction] = useState<any | null>(null);
    const [searchSignature, setSearchSignature] = useState('');
    const [recoveryPin, setRecoveryPin] = useState('');
    const [partialRecoveryAmount, setPartialRecoveryAmount] = useState<number | ''>('');
    const [fee, setFee] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const signForm = useForm<z.infer<typeof signSchema>>({
        resolver: zodResolver(signSchema),
        defaultValues: { amount: 0, securityLevel: 'none' }
    });

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
        defaultValues: { pin: "" }
    });

    const updatePinForm = useForm<z.infer<typeof updatePinSchema>>({
        resolver: zodResolver(updatePinSchema),
        defaultValues: { newPin: "" }
    });

    const watchedAmount = signForm.watch('amount');
    const watchedCurrency = signForm.watch('currency');
    const watchedSecurity = signForm.watch('securityLevel');

    const fetchData = useCallback(async () => {
        const current = await getAuthenticatedUser();
        if (current) {
            setUser(current);
            const sigs = await getHardwareSignatures(current.id);
            setSignatures(sigs);
            const code = countryToCode(current.country);
            const countryInfo = getCountryByCode(code || 'CD');
            signForm.setValue('currency', countryInfo?.currency_code || 'CDF');
        }
        setIsLoading(false);
    }, [signForm]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const updateFee = async () => {
            if (watchedAmount > 0 && watchedCurrency && user) {
                const calculatedFee = await calculateTransactionFee(watchedAmount, watchedCurrency, 'HSM_LOCK', user.country);
                setFee(calculatedFee);
            } else { setFee(0); }
        };
        updateFee();
    }, [watchedAmount, watchedCurrency, user]);

    const handlePinSubmit = async (values: z.infer<typeof pinSchema>) => {
        if (!user) return;
        const signData = signForm.getValues();
        setIsProcessing(true);
        const result = await signTransactionWithHardwareKey({
            amount: Number(signData.amount),
            currency: signData.currency,
            securityLevel: signData.securityLevel as 'none' | 'pin_protected',
            keyPin: signData.keyPin,
            userPin: values.pin
        });
        setIsProcessing(false);

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
            
            openAlert({ title: t('cpkArchiveGenerated'), description: t('cpkArchiveGeneratedDesc'), variant: 'success' });
            signForm.reset();
            fetchData();
        } else {
            openAlert({ title: "Échec", description: result.error || "Une erreur est survenue.", variant: 'error'});
        }
        setIsPinOpen(false);
        pinForm.reset();
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
                toast({ title: t('cpkKeyDetected'), description: t('cpkKeyDetectedDesc') });
            } else {
                openAlert({ title: "Échec de l'importation", description: extraction.error || "Fichier invalide.", variant: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const handleRecover = async (full: boolean) => {
        if (!searchSignature) return;
        setIsProcessing(true);
        const result = await recoverSignedBalance({
            signature: searchSignature,
            keyPin: recoveryPin,
            partialAmount: full ? undefined : (partialRecoveryAmount === '' ? undefined : Number(partialRecoveryAmount))
        });
        setIsProcessing(false);

        if (result.success) {
            openAlert({ title: t('cpkRecoverSuccess'), description: t('cpkRecoverSuccessDesc', {amount: result.amount, currency: result.currency}), variant: 'success' });
            setSearchSignature('');
            setRecoveryPin('');
            setPartialRecoveryAmount('');
            fetchData();
        } else {
            openAlert({ title: t('error'), description: result.error, variant: 'error' });
        }
    };

    const handleCancelClick = (ref: string) => {
        setSelectedSigForAction({ reference: ref });
        setIsCancelPinOpen(true);
    };

    const handleConfirmCancel = async (values: z.infer<typeof pinSchema>) => {
        if (!selectedSigForAction || !user) return;
        setIsProcessing(true);
        const result = await cancelHardwareSignature({
            reference: selectedSigForAction.reference,
            userId: user.id,
            pin: values.pin
        });
        setIsProcessing(false);

        if (result.success) {
            openAlert({ title: t('cpkRevoked'), description: t('cpkRevokedDesc'), variant: 'success' });
            setIsCancelPinOpen(false);
            setSelectedSigForAction(null);
            pinForm.reset();
            fetchData();
        } else {
            openAlert({ title: t('error'), description: result.error, variant: 'error' });
        }
    };

    const handleUpdatePinSubmit = async (values: z.infer<typeof updatePinSchema>) => {
        if (!selectedSigForAction) return;
        setIsProcessing(true);
        const result = await updateHardwareKeyPin(selectedSigForAction.signature, values.oldPin || null, values.newPin);
        setIsProcessing(false);

        if (result.success) {
            toast({ title: "PIN mis à jour", variant: "success" });
            setIsUpdatePinOpen(false);
            updatePinForm.reset();
            fetchData();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <DashboardLayout pageTitleKey="cpkPageTitle">
            <main className="max-w-4xl mx-auto p-4 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <Usb className="h-10 w-10 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{t('cpkEngine')}</h1>
                            <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest">{t('cpkVersion')}</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="h-7 border-primary/30 text-primary px-3">
                        <ShieldCheck className="mr-1.5 h-4 w-4"/> {t('cpkRegistryActive')}
                    </Badge>
                </div>

                {/* Dialogs */}
                <Dialog open={isPinOpen} onOpenChange={setIsPinOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{t('cpkValidateSignature')}</DialogTitle></DialogHeader>
                        <Form {...pinForm}>
                            <form onSubmit={pinForm.handleSubmit(handlePinSubmit)} className="space-y-6 pt-4 text-center">
                                <p className="text-sm text-zinc-400">Total à débiter :</p>
                                <p className="text-2xl font-black">{(Number(watchedAmount || 0) + fee).toFixed(2)} {watchedCurrency}</p>
                                <FormField control={pinForm.control} name="pin" render={({field}) => (
                                    <FormItem><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                                )}/>
                                <Button type="submit" variant="gradient" className="w-full" disabled={isProcessing}>
                                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} {t('cpkSignAndGenerate')}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isUpdatePinOpen} onOpenChange={setIsUpdatePinOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Changer le PIN de la clé</DialogTitle></DialogHeader>
                        <Form {...updatePinForm}>
                            <form onSubmit={updatePinForm.handleSubmit(handleUpdatePinSubmit)} className="space-y-4 pt-4">
                                {selectedSigForAction?.security_level === 'pin_protected' && (
                                    <FormField control={updatePinForm.control} name="oldPin" render={({field}) => (
                                        <FormItem><FormLabel>Ancien PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                                    )}/>
                                )}
                                <FormField control={updatePinForm.control} name="newPin" render={({field}) => (
                                    <FormItem><FormLabel>Nouveau PIN (4 chiffres)</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                                )}/>
                                <DialogFooter><Button type="submit" disabled={isProcessing}>Mettre à jour</Button></DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isCancelPinOpen} onOpenChange={setIsCancelPinOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{t('cpkRevokeCertificate')}</DialogTitle></DialogHeader>
                        <Form {...pinForm}>
                            <form onSubmit={pinForm.handleSubmit(handleConfirmCancel)} className="space-y-6 pt-4 text-center">
                                <p className="text-sm text-muted-foreground">{t('cpkRevokeWarning')}</p>
                                <FormField control={pinForm.control} name="pin" render={({field}) => (
                                    <FormItem><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                                )}/>
                                <Button type="submit" variant="destructive" className="w-full" disabled={isProcessing}>{t('cpkConfirmRevocation')}</Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>

                <Tabs defaultValue="issue" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="issue">{t('cpkTabIssue')}</TabsTrigger>
                        <TabsTrigger value="recover">{t('cpkTabRecover')}</TabsTrigger>
                        <TabsTrigger value="history">{t('cpkTabHistory')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="issue" className="pt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('cpkNewCertificate')}</CardTitle>
                                <CardDescription>{t('cpkNewCertificateDesc')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...signForm}>
                                    <form onSubmit={signForm.handleSubmit(() => setIsPinOpen(true))} className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={signForm.control} name="amount" render={({field}) => (
                                                <FormItem><FormLabel>{t('cpkAmount')}</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field}/></FormControl></FormItem>
                                            )}/>
                                            <FormField control={signForm.control} name="currency" render={({field}) => (
                                                <FormItem><FormLabel>{t('cpkCurrency')}</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="USD">USD ($)</SelectItem>
                                                            <SelectItem value="EUR">EUR (€)</SelectItem>
                                                            <SelectItem value="CDF">CDF (FC)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}/>
                                        </div>

                                        <FormField control={signForm.control} name="securityLevel" render={({field}) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel>{t('cpkSecurityLevel')}</FormLabel>
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="l-none" /><Label htmlFor="l-none">{t('cpkLevelNone')}</Label></div>
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="pin_protected" id="l-pin" /><Label htmlFor="l-pin">{t('cpkLevelPin')}</Label></div>
                                                    </RadioGroup>
                                                </FormControl>
                                            </FormItem>
                                        )}/>

                                        {watchedSecurity === 'pin_protected' && (
                                            <FormField control={signForm.control} name="keyPin" render={({field}) => (
                                                <FormItem>
                                                    <FormLabel>{t('cpkKeyPinLabel')}</FormLabel>
                                                    <FormControl><Input type="password" maxLength={4} placeholder="****" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        )}

                                        <Button type="submit" variant="gradient" className="w-full h-12" disabled={!watchedAmount || watchedAmount <= 0}>
                                            {t('cpkGenerateButton')}
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="recover" className="pt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('cpkRecoverTitle')}</CardTitle>
                                <CardDescription>{t('cpkRecoverDesc')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-all">
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                    <p className="text-sm font-medium">{t('cpkImportFile')}</p>
                                    <input ref={fileInputRef} type="file" accept=".cpk" className="hidden" onChange={handleFileImport} />
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>{t('cpkKeyHLabel')}</Label>
                                        <Input placeholder="Signature de l'archive..." value={searchSignature} onChange={e => setSearchSignature(e.target.value)}/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('cpkKeyPinInput')}</Label>
                                        <Input type="password" placeholder="****" value={recoveryPin} onChange={e => setRecoveryPin(e.target.value)}/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Montant d'encaissement (Vide pour tout encaisser)</Label>
                                        <Input type="number" placeholder="Ex: 10.00" value={partialRecoveryAmount} onChange={e => setPartialRecoveryAmount(e.target.value === '' ? '' : Number(e.target.value))}/>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="outline" onClick={() => handleRecover(false)} disabled={!searchSignature || isProcessing || partialRecoveryAmount === ''}>Encaisser Partiel</Button>
                                    <Button onClick={() => handleRecover(true)} disabled={!searchSignature || isProcessing}>TOUT ENCAISSER</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="history" className="pt-6">
                        <Card>
                            <CardHeader><CardTitle>{t('cpkHistoryTitle')}</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableBody>
                                        {signatures.map(sig => (
                                            <TableRow key={sig.reference}>
                                                <TableCell className="text-xs">
                                                    <p className="font-bold">{sig.reference}</p>
                                                    <p className="text-muted-foreground">{sig.date}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-bold">{sig.amount.toFixed(2)} {sig.currency}</p>
                                                    <Badge variant="outline" className="text-[10px]">{sig.security_level === 'none' ? 'LIBRE' : 'PROTEGÉ'}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn(
                                                        sig.status === 'active' ? "bg-green-500" : 
                                                        sig.status === 'claimed' ? "bg-zinc-500" : "bg-red-500"
                                                    )}>
                                                        {sig.status === 'active' ? t('cpkStatusActive') : sig.status === 'claimed' ? t('cpkStatusClaimed') : t('cpkStatusCancelled')}
                                                    </Badge>
                                                    {sig.linked_card_id && <p className="text-[8px] mt-1 text-primary">Lié à carte: {sig.linked_card_id}</p>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => {
                                                                setSelectedSigForAction(sig);
                                                                setIsUpdatePinOpen(true);
                                                            }}><KeyRound className="mr-2 h-4 w-4"/> Changer PIN</DropdownMenuItem>
                                                            {sig.status === 'active' && (
                                                                <DropdownMenuItem className="text-red-600" onClick={() => handleCancelClick(sig.reference)}>
                                                                    <XCircle className="mr-2 h-4 w-4" /> {t('cpkRevokeAction')}
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </DashboardLayout>
    );
}
