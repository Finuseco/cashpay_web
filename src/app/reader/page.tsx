
'use client';

import { useState, useRef } from 'react';
import { Shield, FileWarning, Unlock, Lock, Usb, ArrowLeft, Download, Info, CheckCircle2, XCircle, Loader2, Upload, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { parseCpkHeader, decryptCpkPayload, type CpkHeader, type CpkPayload } from '@/lib/cpk-utils';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import Image from 'next/image';

type ReaderState = 'idle' | 'detected' | 'unlocking' | 'viewing';

export default function CashPayReaderPage() {
    const [state, setState] = useState<ReaderState>('idle');
    const [header, setHeader] = useState<CpkHeader | null>(null);
    const [payload, setPayload] = useState<CpkPayload | null>(null);
    const [encryptedPart, setEncryptedPart] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            const result = parseCpkHeader(content);
            
            if (result.success && result.header) {
                setHeader(result.header);
                setEncryptedPart(result.encryptedPart!);
                setState('detected');
                setError(null);
            } else {
                setError(result.error || "Fichier invalide");
            }
        };
        reader.readAsText(file);
    };

    const handleUnlock = async () => {
        setIsProcessing(true);
        setError(null);
        
        const result = await decryptCpkPayload(encryptedPart, pin);
        setIsProcessing(false);

        if (result.success && result.data) {
            setPayload(result.data);
            setState('viewing');
        } else {
            setError(result.error || "Erreur de déchiffrement");
            setPin('');
        }
    };

    const reset = () => {
        setState('idle');
        setHeader(null);
        setPayload(null);
        setEncryptedPart('');
        setPin('');
        setError(null);
    };

    return (
        <main className="min-h-screen bg-[#0b0f1a] text-zinc-100 flex flex-col items-center justify-center p-4 font-sans">
            {/* Window Controls (Style Desktop) */}
            <div className="fixed top-0 left-0 right-0 h-8 bg-zinc-900 flex items-center justify-between px-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <Usb className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">CashPay Reader USB v2.0 (Offline)</span>
                </div>
                <div className="flex gap-4 opacity-30 text-[10px] font-bold">
                    <span>MODE AVION ACTIF</span>
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                </div>
            </div>

            <div className="w-full max-w-md space-y-6">
                <div className="text-center mb-8">
                    <Logo className="w-40 mx-auto" />
                </div>

                {state === 'idle' && (
                    <Card className="bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden">
                        <CardHeader className="text-center border-b border-zinc-800 bg-zinc-950/50">
                            <CardTitle className="text-white">Lecteur de Certificat</CardTitle>
                            <CardDescription>Insérez votre support USB ou sélectionnez un fichier .cpk</CardDescription>
                        </CardHeader>
                        <CardContent className="p-10">
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="group border-2 border-dashed border-zinc-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                            >
                                <div className="h-16 w-16 rounded-full bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload className="h-8 w-8 text-zinc-500 group-hover:text-primary" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-zinc-300">Importer .cpk</p>
                                    <p className="text-xs text-zinc-500 mt-1">Glissez-déposez ou cliquez ici</p>
                                </div>
                            </div>
                            <input ref={fileInputRef} type="file" accept=".cpk" className="hidden" onChange={handleFileSelect} />
                        </CardContent>
                        <CardFooter className="bg-zinc-950/30 p-4 justify-center gap-6">
                            <div className="flex items-center gap-2 text-zinc-500"><Monitor className="h-4 w-4"/> <span className="text-[10px] font-bold">Windows</span></div>
                            <div className="flex items-center gap-2 text-zinc-500"><Smartphone className="h-4 w-4"/> <span className="text-[10px] font-bold">Android</span></div>
                        </CardFooter>
                    </Card>
                )}

                {state === 'detected' && header && (
                    <Card className="bg-zinc-900 border-zinc-800 shadow-2xl border-t-4 border-t-primary animate-in fade-in slide-in-from-bottom-4">
                        <CardHeader className="text-center">
                            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Shield className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle className="text-xl">Certificat Détecté</CardTitle>
                            <CardDescription>Données cryptées identifiées</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-zinc-500">Émetteur:</span><span className="font-bold text-zinc-300">{header.iss}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-500">Date d'émission:</span><span className="text-zinc-300">{header.date}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-500">Pays:</span><span className="text-zinc-300">{header.cou}</span></div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center block">Saisir le Code PIN</Label>
                                <div className="flex justify-center pt-2">
                                    <InputOTP maxLength={4} value={pin} onChange={setPin}>
                                        <InputOTPGroup>
                                            <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                                        </InputOTPGroup>
                                    </InputOTP>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col gap-2">
                            <Button onClick={handleUnlock} className="w-full h-12 font-bold text-lg" disabled={pin.length < 4 || isProcessing}>
                                {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <Unlock className="mr-2 h-5 w-5" />}
                                Déverrouiller le contenu
                            </Button>
                            <Button variant="ghost" onClick={reset} className="text-zinc-500">Annuler</Button>
                        </CardFooter>
                    </Card>
                )}

                {state === 'viewing' && payload && (
                    <Card className="bg-zinc-900 border-zinc-800 shadow-2xl relative overflow-hidden animate-in zoom-in-95">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <CheckCircle2 className="h-32 w-32" />
                        </div>
                        <CardHeader className="text-center pb-2">
                            <div className="h-10 w-10 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                            </div>
                            <CardTitle className="text-xs font-bold text-green-500 uppercase tracking-widest">Valeur Faciale Certifiée</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 text-center">
                            <div>
                                <p className="text-5xl font-black tracking-tighter text-white">
                                    {payload.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                    <span className="text-xl font-normal ml-2 text-primary">{payload.currency}</span>
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 text-left space-y-3">
                                <div className="flex justify-between items-baseline border-b border-zinc-800 pb-2">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Titulaire</span>
                                    <span className="text-sm font-semibold">{payload.owner}</span>
                                </div>
                                <div className="flex justify-between items-baseline border-b border-zinc-800 pb-2">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Référence</span>
                                    <span className="text-xs font-mono">{payload.ref}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Clé H (Signature)</span>
                                    <span className="text-[9px] font-mono text-primary max-w-[150px] truncate">{payload.h}</span>
                                </div>
                            </div>

                            <Alert className="bg-zinc-950 border-zinc-800 text-zinc-400 text-[10px] text-left">
                                <Info className="h-3 w-3" />
                                <AlertDescription>
                                    Ceci est un document hors-ligne. Pour encaisser ces fonds vers un compte bancaire ou Mobile Money, importez ce fichier dans votre application CashPay connectée.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" onClick={reset} className="w-full bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Fermer le lecteur
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {error && (
                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400 animate-in shake">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Erreur</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Footer Navigation (Reader Only) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-center text-[10px] text-zinc-600 gap-8">
                <p>&copy; {new Date().getFullYear()} FINUSECO SARL</p>
                <div className="flex gap-4">
                    <Link href="#" className="hover:text-zinc-400">Support</Link>
                    <Link href="#" className="hover:text-zinc-400">Légal</Link>
                </div>
            </div>
        </main>
    );
}
