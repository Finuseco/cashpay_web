
'use client';

import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import type { User, Currency } from '@/lib/types';
import { Copy, Printer, Share2, Check, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/**
 * Composant de réception QR Code stabilisé.
 * Remplace les listes déroulantes par des groupes de boutons pour éviter les bugs de rendu.
 */
export function ReceiveQrCode({ user }: { user: User | null }) {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    
    const [amount, setAmount] = useState<string>('');
    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    // Initialisation sécurisée côté client
    useEffect(() => {
        setIsClient(true);
        const loadCurrencies = async () => {
            if (user) {
                try {
                    const data = await getUserCurrencies(user.id);
                    setCurrencies(data);
                    // Sélectionner par défaut le premier portefeuille avec solde ou USD
                    const defaultCur = data.find(c => c.code === 'USD') || data[0];
                    if (defaultCur) setSelectedCurrency(defaultCur.code);
                } catch (e) {
                    console.error("Failed to load currencies for QR", e);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadCurrencies();
    }, [user]);

    // Calcul dynamique du QR Code sans rechargement de page
    const qrValue = useMemo(() => {
        if (!user) return "";
        const numericAmount = parseFloat(amount);
        if (!isNaN(numericAmount) && numericAmount > 0) {
            return JSON.stringify({
                recipient: user.id_wallet,
                amount: numericAmount,
                currency: selectedCurrency,
                type: 'PAYMENT_REQUEST'
            });
        }
        return user.id_wallet || "";
    }, [user, amount, selectedCurrency]);

    const copyToClipboard = () => {
        if (user?.id_wallet) {
          navigator.clipboard.writeText(user.id_wallet);
          toast({ title: 'Copié !', description: 'Identifiant de portefeuille copié.' });
        }
    };

    const handleDownloadPdf = async () => {
        if (!user) return;
        setIsGenerating(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            
            doc.setFontSize(22);
            doc.setTextColor(0, 14, 56); // #000E38
            doc.text("CASH PAY ALL", 105, 40, { align: 'center' });
            
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 100);
            doc.text("IDENTIFIANT DE RÉCEPTION SOUVERAIN", 105, 50, { align: 'center' });
            
            doc.setDrawColor(255, 102, 0); // #FF6600
            doc.line(40, 55, 170, 55);

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Titulaire : ${user.full_name}`, 105, 70, { align: 'center' });
            doc.text(`Wallet ID : ${user.id_wallet}`, 105, 78, { align: 'center' });
            
            if (amount && parseFloat(amount) > 0) {
                doc.setFontSize(18);
                doc.text(`MONTANT DEMANDÉ : ${amount} ${selectedCurrency}`, 105, 95, { align: 'center' });
            }

            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text("Scannez ce code via l'application CashPay pour envoyer des fonds.", 105, 220, { align: 'center' });
            
            doc.save(`CashPay_QR_${user.id_wallet}.pdf`);
        } catch (e) {
            console.error("PDF generation error", e);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isClient) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    if (isLoading) {
        return (
            <Card className="border-none shadow-sm">
                <CardContent className="p-12 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin h-10 w-10 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sécurisation du tunnel...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-2xl overflow-hidden bg-background">
                <CardHeader className="bg-primary/5 border-b border-primary/10 text-center py-8">
                    <CardTitle className="text-2xl font-black uppercase tracking-tight text-primary">Mon QR Code</CardTitle>
                    <CardDescription>Recevez des fonds instantanément en faisant scanner ce code.</CardDescription>
                </CardHeader>
                
                <CardContent className="p-6 space-y-8">
                    {/* Groupe de devises : Sélection par blocs pour éviter les listes roulantes */}
                    <div className="space-y-4">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground text-center block">
                            Sélectionner le portefeuille de réception
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {currencies.map((c) => (
                                <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => setSelectedCurrency(c.code)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all h-20 relative",
                                        selectedCurrency === c.code 
                                            ? "border-primary bg-primary/5 text-primary shadow-md" 
                                            : "border-zinc-100 text-zinc-500 hover:bg-zinc-50"
                                    )}
                                >
                                    <span className="text-sm font-black">{c.code}</span>
                                    <span className="text-[10px] opacity-60 font-bold mt-1">{c.balance}</span>
                                    {selectedCurrency === c.code && (
                                        <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5">
                                            <Check className="h-3 w-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Montant flexible */}
                    <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground text-center block">
                            Montant spécifique (Optionnel)
                        </Label>
                        <div className="relative">
                            <Input 
                                type="number" 
                                placeholder="0.00" 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="h-16 text-4xl font-black text-center border-zinc-200 focus-visible:ring-primary/20 rounded-2xl"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">
                                {selectedCurrency}
                            </div>
                        </div>
                    </div>

                    {/* Affichage du QR Code */}
                    <div className="flex flex-col items-center gap-6 py-10 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 shadow-inner">
                        <div className="bg-white p-6 rounded-[2rem] shadow-2xl border-4 border-white transition-transform hover:scale-105 duration-500">
                            <QRCodeSVG 
                                value={qrValue} 
                                size={220} 
                                level="H"
                                includeMargin={false}
                            />
                        </div>
                        <div className="text-center space-y-3">
                            <p className="font-black text-xl uppercase tracking-tight text-foreground">{user?.full_name}</p>
                            <div className="flex items-center justify-center gap-3 text-primary font-mono font-bold bg-primary/10 px-6 py-2.5 rounded-full border border-primary/10">
                                <span className="tracking-widest">{user?.id_wallet}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary" onClick={copyToClipboard}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="bg-zinc-50/50 border-t flex flex-col sm:flex-row gap-3 p-6">
                    <Button variant="outline" className="w-full h-12 font-bold text-xs uppercase tracking-widest" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4"/> Imprimer
                    </Button>
                    <Button variant="outline" className="w-full h-12 font-bold text-xs uppercase tracking-widest" onClick={handleDownloadPdf} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="animate-spin h-4 w-4"/> : <Share2 className="mr-2 h-4 w-4"/>} 
                        Télécharger PDF
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
