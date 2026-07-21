'use client';

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Fingerprint, KeyRound, ShieldCheck, SmartphoneNfc, Terminal, MessageSquare, Mail, Phone, BellRing, Loader2, Usb, Video, Globe, FileText, Upload, CheckCircle, XCircle, Trash2, Download, Lock, Unlock, Shield, FileJson, MoreHorizontal, FileArchive } from "lucide-react";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { ChangePinForm } from "./change-pin-form";
import { BecomeAgentSection } from "./become-agent";
import { AiAssistantSettings } from "./ai-assistant-settings";
import type { User } from '@/lib/types';
import { Checkbox } from "@/components/ui/checkbox";
import { updatePin, savePushSubscription } from "@/lib/actions/user.actions";
import { getGoogleOauthUrl } from "@/lib/actions/google.actions";
import { getZoomOauthUrl } from "@/services/zoom";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signTransactionWithHardwareKey, recoverSignedBalance, getHardwareSignatures, cancelHardwareSignature, extractSignatureFromCpk } from "@/lib/actions/security.actions";
import { calculateTransactionFee } from "@/lib/actions/wallet.actions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import JSZip from 'jszip';
import { cn, countryToCode, getCountryByCode } from "@/lib/utils";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { fr } from 'date-fns/locale';
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const SettingsRow = ({ icon: Icon, title, description, children }: { icon: React.ElementType, title: string, description: string, children: React.ReactNode }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Icon className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
    </div>
);

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

const hardwareSignSchema = z.object({
    amount: z.coerce.number().positive("Le montant doit être positif."),
    currency: z.string().min(1, "Devise requise."),
    securityLevel: z.enum(['none', 'pin_protected']),
    keyPin: z.string().optional(),
}).refine(data => data.securityLevel === 'none' || (data.keyPin && data.keyPin.length === 4), {
    message: "Le PIN de la clé est requis.",
    path: ["keyPin"]
});

const HardwareKeySection = ({ user }: { user: User }) => {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [isCancelPinOpen, setIsCancelPinOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchSignature, setSearchSignature] = useState('');
    const [recoveryPin, setRecoveryPin] = useState('');
    const [mySignatures, setMySignatures] = useState<any[]>([]);
    const [selectedSigForCancel, setSelectedSigForCancel] = useState<string | null>(null);
    const [fee, setFee] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const userCountryCode = countryToCode(user.country) || 'CD';
    const countryInfo = getCountryByCode(userCountryCode);
    const nationalCurrency = countryInfo?.currency_code || 'CDF';

    const signForm = useForm<z.infer<typeof hardwareSignSchema>>({
        resolver: zodResolver(hardwareSignSchema),
        defaultValues: { amount: 0, currency: nationalCurrency, securityLevel: 'none' }
    });

    const watchedAmount = signForm.watch('amount');
    const watchedCurrency = signForm.watch('currency');
    const watchedSecurity = signForm.watch('securityLevel');

    useEffect(() => {
        const updateFee = async () => {
            if (watchedAmount > 0 && watchedCurrency) {
                const calculatedFee = await calculateTransactionFee(watchedAmount, watchedCurrency, 'HSM_LOCK', user.country);
                setFee(calculatedFee);
            } else { setFee(0); }
        };
        updateFee();
    }, [watchedAmount, watchedCurrency, user.country]);

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
        defaultValues: { pin: "" },
    });

    const fetchMySignatures = useCallback(async () => {
        const sigs = await getHardwareSignatures(user.id);
        setMySignatures(sigs);
    }, [user.id]);

    useEffect(() => {
        fetchMySignatures();
    }, [fetchMySignatures]);

    const getCpkContent = (signature: string, amount: string, currency: string, level: string, encryptedPayload?: string) => {
        return `
=====================================================================
          CASHPAY SECURE HARDWARE ASSET - PREUVE DE PROPRIÉTÉ
=====================================================================

DÉTAILS DU CERTIFICAT :
---------------------------------------------------------------------
VERSION: 2.0
NIVEAU DE SÉCURITÉ: ${level}
CLÉ H (SIGNATURE): ${signature}
DATE D'ÉMISSION: ${format(new Date(), "dd MMMM yyyy HH:mm:ss", { locale: fr })}
TITULAIRE: ${user.full_name.toUpperCase()}
VALEUR NOMINALE: ${amount} ${currency}
ORIGINE: CashPay Central Network (Souverain)
---------------------------------------------------------------------

[SECURE-DATA-BLOCK]
${encryptedPayload || "DATA_ENCRYPTED_ON_SERVER_CORE_PROTECTION"}
[/SECURE-DATA-BLOCK]

_____________________________________________________________________
Protected by CashPay HSM Protocol. (c) ${new Date().getFullYear()} FINUSECO SARL.
`;
    };

    const downloadFile = (content: string, fileName: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateAndDownloadCpk = (signature: string, amount: string, currency: string, level: string, encryptedPayload?: string) => {
        const content = getCpkContent(signature, amount, currency, level, encryptedPayload);
        const fileName = `CERTIFICAT_VALEUR_${signature.substring(0, 8)}.cpk`;
        downloadFile(content, fileName, 'text/plain');
    };

    const generateAndDownloadZip = async (signature: string, amount: string, currency: string, level: string, encryptedPayload?: string) => {
        const zip = new JSZip();
        const userNameRef = user.full_name.replace(/\s/g, '_').toUpperCase();
        const fileContent = getCpkContent(signature, amount, currency, level, encryptedPayload);
        zip.file(`CERTIFICAT_VALEUR_${signature.substring(0, 8)}.cpk`, fileContent);
        const blob = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CashPay_USB_Package_${userNameRef}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleInitialSignSubmit = () => {
        setIsPinDialogOpen(true);
    };

    const handlePinSubmit = async (values: z.infer<typeof pinSchema>) => {
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
            await generateAndDownloadZip(result.signature, signData.amount.toString(), signData.currency, signData.securityLevel, result.encryptedPayload);
            openAlert({ title: "Package Prêt", description: "L'archive ZIP contenant votre certificat .cpk a été générée.", variant: 'success' });
            signForm.reset();
            fetchMySignatures();
        } else {
            openAlert({ title: "Échec", description: result.error || "Une erreur est survenue.", variant: 'error'});
        }
        setIsPinDialogOpen(false);
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
                toast({ title: "Clé détectée", description: "Le code H a été extrait du fichier." });
            } else {
                openAlert({ title: "Importation échouée", description: extraction.error || "Fichier invalide.", variant: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const handleCancelClick = (ref: string) => {
        setSelectedSigForCancel(ref);
        setIsCancelPinOpen(true);
    };

    const handleConfirmCancel = async (values: z.infer<typeof pinSchema>) => {
        if (!selectedSigForCancel) return;
        setIsProcessing(true);
        const result = await cancelHardwareSignature({
            reference: selectedSigForCancel,
            userId: user.id,
            pin: values.pin
        });
        setIsProcessing(false);

        if (result.success) {
            openAlert({ title: "Annulé", description: "La clé a été révoquée et le capital remboursé.", variant: 'success' });
            setIsCancelPinOpen(false);
            setSelectedSigForCancel(null);
            pinForm.reset();
            fetchMySignatures();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    const handleRecover = async () => {
        if (!searchSignature) return;
        setIsProcessing(true);
        const result = await recoverSignedBalance({
            signature: searchSignature,
            keyPin: recoveryPin
        });
        setIsProcessing(false);

        if (result.success) {
            openAlert({ title: "Fonds Encaissés", description: `Un montant de ${result.amount} ${result.currency} a été crédité sur votre compte.`, variant: 'success' });
            setSearchSignature('');
            setRecoveryPin('');
            fetchMySignatures();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    return (
      <div className="space-y-6">
        <Dialog open={!!selectedSigForCancel} onOpenChange={(open) => !open && setSelectedSigForCancel(null)}>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                <DialogHeader><DialogTitle>Annuler la Signature</DialogTitle><DialogDescription>Récupérez votre capital en annulant cette clé USB.</DialogDescription></DialogHeader>
                 <Form {...pinForm}>
                    <form onSubmit={pinForm.handleSubmit(handleConfirmCancel)} className="space-y-4">
                        <FormField control={pinForm.control} name="pin" render={({ field }) => (
                            <FormItem><FormLabel>PIN CashPay</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                        )}/>
                        <DialogFooter><Button type="submit" variant="destructive" disabled={isProcessing} className="w-full">Confirmer l'annulation</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

        <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Confirmer la Signature</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Total à débiter : <span className="font-bold text-white">{(Number(watchedAmount || 0) + fee).toFixed(2)} {watchedCurrency}</span>
                    </DialogDescription>
                </DialogHeader>
                 <Form {...pinForm}>
                    <form onSubmit={pinForm.handleSubmit(handlePinSubmit)} className="space-y-4">
                        <FormField control={pinForm.control} name="pin" render={({ field }) => (
                            <FormItem><FormLabel>PIN CashPay</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                        )}/>
                        <DialogFooter><Button type="submit" disabled={isProcessing} className="w-full">Signer et Générer Certificat</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

        <div className="space-y-4 pt-6 mt-6 border-t border-zinc-800">
            <h3 className="text-lg font-bold flex items-center gap-2"><Usb className="text-primary"/> Coffre-fort USB Interopérable</h3>
            <p className="text-sm text-muted-foreground italic">Générez un certificat .cpk sécurisé pour transporter de la valeur sur support physique.</p>
            
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-zinc-900 border-zinc-700 text-white shadow-xl">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-primary">Émettre une Valeur USB</CardTitle></CardHeader>
                    <CardContent>
                        <Form {...signForm}>
                            <form onSubmit={signForm.handleSubmit(handleInitialSignSubmit)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField control={signForm.control} name="amount" render={({field}) => (
                                        <FormItem><FormControl><Input type="number" placeholder="Montant" {...field} className="bg-zinc-800 border-zinc-700"/></FormControl></FormItem>
                                    )}/>
                                    <FormField control={signForm.control} name="currency" render={({field}) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                                                    <SelectItem value={nationalCurrency}>{nationalCurrency} (National)</SelectItem>
                                                    <SelectItem value="USD">USD</SelectItem>
                                                    <SelectItem value="EUR">EUR</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}/>
                                </div>

                                <FormField control={signForm.control} name="securityLevel" render={({field}) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Niveau de Sécurité</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="none" /><Label htmlFor="none" className="flex items-center gap-1 cursor-pointer"><Unlock className="h-3 w-3"/> Libre</Label></div>
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="pin_protected" id="pin" /><Label htmlFor="pin" className="flex items-center gap-1 cursor-pointer"><Lock className="h-3 w-3"/> Protégé</Label></div>
                                            </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )}/>

                                {watchedSecurity === 'pin_protected' && (
                                    <FormField control={signForm.control} name="keyPin" render={({field}) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">PIN de la clé (4 chiffres)</FormLabel>
                                            <FormControl><Input type="password" maxLength={4} placeholder="****" {...field} className="bg-zinc-800 border-zinc-700"/></FormControl>
                                        </FormItem>
                                    )} />
                                )}

                                {watchedAmount > 0 && (
                                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-2 text-center animate-in fade-in zoom-in-95">
                                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Frais de sécurisation (HSM)</p>
                                        <div className="flex justify-center items-baseline gap-1">
                                            <span className="text-2xl font-black text-foreground">{fee.toFixed(2)}</span>
                                            <span className="text-sm font-bold text-muted-foreground">{watchedCurrency}</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic">Total à débiter : {(Number(watchedAmount) + fee).toFixed(2)} {watchedCurrency}</p>
                                    </div>
                                )}
                                <Button type="submit" variant="gradient" className="w-full font-bold" disabled={!watchedAmount || watchedAmount <= 0}>Générer Certificat</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800 text-white shadow-xl">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-primary">Encaisser via Clé H</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3">
                            <Button variant="outline" className="border-dashed border-primary text-primary hover:bg-primary/5" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="mr-2 h-4 w-4"/> Importer un fichier .cpk
                            </Button>
                            <input ref={fileInputRef} type="file" accept=".cpk" className="hidden" onChange={handleFileImport} />
                            <div className="flex items-center gap-2">
                                <Separator className="flex-1" />
                                <span className="text-[10px] text-zinc-500">OU SAISIR MANUELLEMENT</span>
                                <Separator className="flex-1" />
                            </div>
                        </div>
                        <Input placeholder="Collez la Clé H du certificat..." className="font-mono text-[10px] bg-zinc-800 border-zinc-700" value={searchSignature} onChange={e => setSearchSignature(e.target.value)}/>
                        <Input type="password" placeholder="PIN de la clé (si protégé)" className="bg-zinc-800 border-zinc-700" value={recoveryPin} onChange={e => setRecoveryPin(e.target.value)}/>
                        <Button className="w-full" variant="default" onClick={handleRecover} disabled={isProcessing || !searchSignature}>Vérifier et Encaisser</Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-zinc-900 border-zinc-800 text-white overflow-hidden shadow-2xl">
                <CardHeader className="bg-zinc-950 border-b border-zinc-800 h-12 flex items-center justify-between"><CardTitle className="text-sm">Archives de Valeurs</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableBody>
                            {mySignatures.map(sig => (
                                <TableRow key={sig.reference} className="border-zinc-800 hover:bg-zinc-800/30">
                                    <TableCell className="text-[10px]">
                                        <p className="font-mono text-zinc-300">#{sig.reference.split('-')[1]}</p>
                                        <p className="text-zinc-500">{sig.date}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-bold text-sm text-white">{sig.amount} {sig.currency}</p>
                                        <Badge variant="outline" className="text-[8px] h-4 border-zinc-700">{sig.security_level === 'none' ? 'LIBRE' : 'PIN'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "text-[9px] uppercase font-black px-2 py-0.5",
                                            sig.status === 'active' ? "bg-green-600 text-white" : 
                                            sig.status === 'claimed' ? "bg-zinc-700 text-zinc-400" : "bg-red-900 text-red-200"
                                        )}>
                                            {sig.status === 'active' ? 'Active' : sig.status === 'claimed' ? 'Encaissée' : 'Annulée'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white">
                                                        <Download className="h-4 w-4"/>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="bg-zinc-800 border-zinc-700 text-white">
                                                    <DropdownMenuItem className="focus:bg-zinc-700 cursor-pointer" onClick={() => generateAndDownloadZip(sig.signature, sig.amount, sig.currency, sig.security_level)}>
                                                        <FileArchive className="mr-2 h-4 w-4 text-primary" /> Télécharger (.ZIP)
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="focus:bg-zinc-700 cursor-pointer" onClick={() => generateAndDownloadCpk(sig.signature, sig.amount, sig.currency, sig.security_level)}>
                                                        <FileText className="mr-2 h-4 w-4 text-blue-400" /> Télécharger (.CPK direct)
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            
                                            {sig.status === 'active' && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-400/10" onClick={() => handleCancelClick(sig.reference)} title="Annuler"><XCircle className="h-4 w-4"/></Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {mySignatures.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-zinc-500 italic text-xs">Aucune archive émise.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    )
}

export function SecuritySettings({ user }: { user: User | null }) {
  const { t } = useTranslation();
  const { openAlert } = useAlertDialog();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isUssdEnabled, setIsUssdEnabled] = useState(true);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [notificationChannel, setNotificationChannel] = useState(user?.notifications_channel || ['sms']);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  useEffect(() => {
    (async () => {
        if (typeof window !== 'undefined' && window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
            setIsBiometricSupported(true);
            const enabled = localStorage.getItem('biometric-auth-enabled') === 'true';
            setIsBiometricEnabled(enabled);
        }
    })();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          if (subscription) {
            setIsPushEnabled(true);
          }
        });
      });
    }
  }, []);

  const handleToggle = (
    checked: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    featureName: string
  ) => {
    setter(checked);
    openAlert({
      title: "Réglage mis à jour",
      description: `${featureName} a été ${checked ? 'activé' : 'désactivé'}.`,
      variant: "info",
    });
  };

  const handleBiometricToggle = async (checked: boolean) => {
    if (checked) {
        localStorage.setItem('biometric-auth-enabled', 'true');
        setIsBiometricEnabled(true);
        openAlert({
            title: t('securityBiometricEnabledTitle'),
            description: t('securityBiometricEnabledDesc'),
            variant: 'success',
        });
    } else {
        localStorage.removeItem('biometric-auth-enabled');
        setIsBiometricEnabled(false);
        openAlert({
            title: t('securityBiometricDisabledTitle'),
            description: t('securityBiometricDisabledDesc'),
            variant: 'info',
        });
    }
  };

  const handlePinChange = async (values: any) => {
    if (!user) {
        openAlert({ title: "Erreur", description: "Utilisateur non trouvé.", variant: "error" });
        return;
    }
    const result = await updatePin({ userId: user.id, oldPin: values.oldPin, newPin: values.newPin });

    if (result.success) {
        setIsPinDialogOpen(false);
        openAlert({
            title: "PIN mis à jour",
            description: "Votre code PIN a été changé avec succès.",
            variant: "success",
        });
    } else {
        openAlert({
            title: "Erreur",
            description: result.error,
            variant: "error",
        });
    }
  };
  
  const notificationOptions = [
    { id: 'sms', label: t('securitySmsChannel'), icon: MessageSquare },
    { id: 'email', label: t('securityEmailChannel'), icon: Mail, disabled: !user?.email },
    { id: 'whatsapp', label: t('securityWhatsappChannel'), icon: Phone },
  ];
  
  const handleLinkGoogle = async () => {
    const googleUrl = await getGoogleOauthUrl();
    window.location.href = googleUrl;
  };
  
  const handleLinkZoom = async () => {
      const zoomUrl = await getZoomOauthUrl();
      window.location.href = zoomUrl;
  };

  const handleEnablePushNotifications = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        openAlert({ title: 'Non supporté', description: 'Les notifications push ne sont pas supportées par votre navigateur.', variant: 'error' });
        return;
    }
    
    setIsPushLoading(true);
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        openAlert({ title: 'Permission refusée', description: 'Vous avez refusé la permission pour les notifications.', variant: 'warning' });
        setIsPushLoading(false);
        return;
    }
    
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
            console.error('VAPID public key not found.');
            openAlert({ title: 'Erreur de configuration', description: 'La configuration des notifications est incomplète.', variant: 'error' });
            setIsPushLoading(false);
            return;
        }
        
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidPublicKey,
        });
    }

    if (user) {
        const result = await savePushSubscription(user.id, subscription);
        if (result.success) {
            setIsPushEnabled(true);
            openAlert({ title: 'Activé', description: 'Les notifications push ont été activées sur cet appareil.', variant: 'success' });
        } else {
            openAlert({ title: 'Erreur', description: 'Impossible de sauvegarder l\'abonnement aux notifications.', variant: 'error' });
        }
    }
    setIsPushLoading(false);

  }, [user, openAlert]);

  return (
    <>
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('securityPinDialogTitle')}</DialogTitle>
                <DialogDescription>{t('securityPinDialogDescription')}</DialogDescription>
            </DialogHeader>
            <ChangePinForm onFormSubmit={handlePinChange} />
        </DialogContent>
      </Dialog>
      
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('securityAccountTitle')}</CardTitle></CardHeader>
            <CardContent className="divide-y">
               <div className="py-3">
                <SettingsRow icon={KeyRound} title={t('securityChangePin')} description={t('securityChangePinDescription')}>
                    <Button variant="outline" onClick={() => setIsPinDialogOpen(true)}>{t('securityChangePin')}</Button>
                </SettingsRow>
               </div>
               <div className="py-3">
                <SettingsRow icon={ShieldCheck} title={t('security2FA')} description={t('security2FADescription')}>
                    <Switch id="2fa-switch" checked={is2FAEnabled} onCheckedChange={(checked) => handleToggle(checked, setIs2FAEnabled, "L'authentification à deux facteurs")} />
                </SettingsRow>
               </div>
                <div className="py-3">
                    <SettingsRow icon={Video} title="Connexion Zoom" description="Liez votre compte Zoom pour organiser des webinaires.">
                        <Button variant={user?.zoom_refresh_token ? "secondary" : "outline"} onClick={handleLinkZoom}>
                            {user?.zoom_refresh_token ? "Compte Zoom Lié" : "Lier Compte Zoom"}
                        </Button>
                    </SettingsRow>
                </div>
               <div className="py-3">
                <SettingsRow icon={Globe} title={t('securityGoogleLogin')} description={t('securityGoogleLoginDescription')}>
                    <Button variant="outline" onClick={handleLinkGoogle}>{t('securityLinkAccount')}</Button>
                </SettingsRow>
               </div>
               <div className="py-3">
                 <SettingsRow icon={Fingerprint} title={t('securityBiometric')} description={isBiometricSupported ? t('securityBiometricDescription') : t('securityBiometricNotSupported')}>
                    <Switch 
                        id="biometric-switch"
                        checked={isBiometricEnabled} 
                        onCheckedChange={handleBiometricToggle}
                        disabled={!isBiometricSupported}
                    />
                </SettingsRow>
               </div>
               {user && <HardwareKeySection user={user} />}
            </CardContent>
          </Card>
          
           <Card>
            <CardHeader><CardTitle>{t('securityNotificationsTitle')}</CardTitle><CardDescription>{t('securityNotificationsDescription')}</CardDescription></CardHeader>
            <CardContent className="divide-y">
              <div className="py-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
               {notificationOptions.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                        <Checkbox 
                            id={`channel-${option.id}`}
                            checked={notificationChannel.includes(option.id as any)}
                            onCheckedChange={(checked) => {
                                setNotificationChannel(prev => 
                                    checked 
                                    ? [...prev, option.id as any] 
                                    : prev.filter(c => c !== option.id)
                                );
                            }}
                            disabled={option.disabled}
                        />
                        <label
                            htmlFor={`channel-${option.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                        >
                            <option.icon className="h-4 w-4"/>
                            {option.label}
                        </label>
                    </div>
               ))}
              </div>
                <div className="py-3">
                   <SettingsRow icon={BellRing} title={t('securityPushNotifications')} description={t('securityPushNotificationsDescription')}>
                        <Button variant="outline" onClick={handleEnablePushNotifications} disabled={isPushLoading || isPushEnabled}>
                          {isPushLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isPushEnabled ? t('securityActivated') : t('securityActivate')}
                        </Button>
                   </SettingsRow>
                </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('securityAgentSpaceTitle')}</CardTitle></CardHeader>
            <CardContent><BecomeAgentSection user={user} /></CardContent>
          </Card>
          
          <Card>
              <CardHeader><CardTitle>{t('securityUssdService')}</CardTitle></CardHeader>
              <CardContent className="space-y-4 divide-y">
                   <SettingsRow icon={SmartphoneNfc} title={t('securityUssdService')} description={t('securityUssdServiceDescription')}>
                        <Switch id="ussd-switch" checked={isUssdEnabled} onCheckedChange={(checked) => handleToggle(checked, setIsUssdEnabled, "Le service USSD")} />
                   </SettingsRow>
                   <div className="pt-4">
                      <SettingsRow icon={Terminal} title={t('securityUssdSimulator')} description={t('securityUssdSimulatorDescription')}>
                         <Button asChild variant="outline"><Link href="/ussd-simulator">{t('securityLaunchSimulator')}</Link></Button>
                      </SettingsRow>
                   </div>
              </CardContent>
          </Card>

           <Card>
              <CardHeader><CardTitle>{t('securityAiAssistantTitle')}</CardTitle></CardHeader>
              <CardContent>
                  <AiAssistantSettings user={user} />
              </CardContent>
          </Card>
        </div>
      
    </>
  );
}