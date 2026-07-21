'use client';

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Search, ScanLine, X, Plus, Minus, ShoppingCart, Printer, UserCheck, Loader2, ShieldCheck, MessageSquare, Phone, ArrowLeft, QrCode, MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { QrScannerDialog } from "@/components/shared/qr-scanner-dialog";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { Product, ProductCategory, User } from "@/lib/types";
import { cn, generateReferenceCode, currentPrice } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosReceipt } from "./pos-receipt";
import { QRCodeSVG } from 'qrcode.react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { sendAndStoreOtp } from "@/lib/actions/auth.actions";
import { confirmSaleByCode, processQrSale, type ActionResult } from "@/lib/actions/agent.actions";
import { getWalletInfo } from '@/lib/actions/wallet.actions';
import type { WalletInfo } from '@/lib/actions/wallet.actions';
import { InternationalWalletInput } from "../shared/international-wallet-input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import Link from 'next/link';
import { useRouter } from "next/navigation";


export type CartItem = Product & { quantity: number };

export interface LastTransactionDetails {
    items: CartItem[];
    subTotal: number;
    tva: number;
    total: number;
    reference: string;
    boutiqueName: string;
    date: string;
    sellerInfo: { id: number; name: string };
    buyerName?: string;
}

interface PaymentInfo {
    items: CartItem[];
    subTotal: number;
    tva: number;
    total: number;
    reference: string;
    boutiqueName: string;
    sellerInfo: { id: number; name: string };
}

const otpSchema = z.object({
  code: z.string().min(4, { message: "Le code est requis." }),
});

const manualPaymentSchema = z.object({
  walletId: z.string().min(1, 'Wallet ID is required'),
});


export function PosClient({ initialProducts, categories, agent }: { initialProducts: Product[], categories: ProductCategory[], agent: User }) {
    const { t } = useTranslation();
    const router = useRouter();
    const { openAlert } = useAlertDialog();

    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
    const [lastTransaction, setLastTransaction] = useState<LastTransactionDetails | null>(null);
    
    const [verifiedClient, setVerifiedClient] = useState<WalletInfo | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmationMethod, setConfirmationMethod] = useState<'otp' | 'pin'>('otp');

    const otpForm = useForm<z.infer<typeof otpSchema>>({
        resolver: zodResolver(otpSchema),
        defaultValues: { code: "" },
    });

    const manualPaymentForm = useForm<z.infer<typeof manualPaymentSchema>>({
        resolver: zodResolver(manualPaymentSchema),
        defaultValues: { walletId: "" }
    });
    
    const currentBoutique = { id: 'boutique-1', name: 'Boutique Principale', address: '123 Av. du Commerce, Gombe' };


    useEffect(() => {
        setProducts(initialProducts);
    }, [initialProducts]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm));
    }, [searchTerm, products]);

    const handleAddToCart = (product: Product, quantity: number = 1) => {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item));
        } else {
            setCart([...cart, { ...product, quantity }]);
        }
    };

    const handleUpdateQuantity = (productId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            handleRemoveFromCart(productId);
        } else {
            setCart(cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
        }
    };

    const handleRemoveFromCart = (productId: string) => {
        setCart(cart.filter(item => item.id !== productId));
    };

    const handleScanSuccess = async (scannedText: string) => {
        setIsScannerOpen(false);
        const walletIdRegex = /^[A-Z]{2}\d{10}$/;

        try {
            const data = JSON.parse(scannedText);
            if (data.type === 'PRODUCT' && data.productId) {
                 const scannedProduct = products.find(p => p.id === data.productId.toString());
                 if (scannedProduct) {
                    handleAddToCart(scannedProduct);
                    return;
                 }
            }
        } catch(e) {
            if (walletIdRegex.test(scannedText)) {
                if (showPaymentModal) {
                    manualPaymentForm.setValue('walletId', scannedText);
                } else {
                    openAlert({ 
                        variant: "info", 
                        title: "ID Client détecté", 
                        description: `Voulez-vous ouvrir un transfert pour ${scannedText} ?`,
                        showCancel: true,
                        onClose: (confirmed) => confirmed && router.push(`/agent/transfer?recipient=${scannedText}`)
                    });
                }
                return;
            }

            const scannedProduct = products.find(p => p.barcode === scannedText);
            if (scannedProduct) {
                handleAddToCart(scannedProduct);
            } else {
                openAlert({ variant: "error", title: "Code non reconnu", description: `L'article "${scannedText}" n'est pas dans l'inventaire.` });
            }
        }
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => total + currentPrice(item, item.quantity) * item.quantity, 0);
    }, [cart]);

    const handleCheckout = () => {
        if (cart.length === 0) return;
        const subTotal = cartTotal;
        const currentPaymentInfo: PaymentInfo = {
            items: [...cart],
            subTotal,
            tva: 0,
            total: subTotal,
            reference: generateReferenceCode('SALE'),
            boutiqueName: currentBoutique.name,
            sellerInfo: { id: agent.id, name: agent.full_name },
        };
        setPaymentInfo(currentPaymentInfo);
        setShowPaymentModal(true);
    };
    
    const handlePaymentSuccess = useCallback(() => {
        if (!paymentInfo) return;
        const newTransaction: LastTransactionDetails = { 
            ...paymentInfo, 
            date: new Date().toISOString(),
            buyerName: verifiedClient?.userName || 'Client au comptant',
        };
        setLastTransaction(newTransaction);
        setShowPaymentModal(false);
        setShowOtpModal(false);
    }, [paymentInfo, verifiedClient]);
    
    const handleInitiateManualPayment = async () => {
        if (!verifiedClient?.userId || !paymentInfo) return;
        setIsSubmitting(true);
        const otpResult = await sendAndStoreOtp(verifiedClient.userId, `un achat de ${paymentInfo.total.toFixed(2)} USD`, 'sms');
        if (otpResult.success) {
            setShowOtpModal(true);
        } else {
            openAlert({ title: "Erreur", description: "Échec de l'envoi du code.", variant: 'error' });
        }
        setIsSubmitting(false);
    }
    
    const handleCodeConfirmation = async (data: z.infer<typeof otpSchema>) => {
        if (!verifiedClient?.userId || !paymentInfo) return;
        setIsSubmitting(true);
        const result = await confirmSaleByCode({
            userId: verifiedClient.userId,
            code: data.code,
            method: confirmationMethod,
            order: paymentInfo
        });
        
        if (result.success) {
            handlePaymentSuccess();
        } else {
            otpForm.setError('code', {type: 'manual', message: (result as ActionResult).error || 'Code invalide.'});
        }
        setIsSubmitting(false);
    };

    const closeReceiptAndReset = () => {
        setLastTransaction(null);
        setCart([]);
        setVerifiedClient(null);
        setPaymentInfo(null);
    };

    const paymentQRCodeValue = useMemo(() => {
        if (!paymentInfo) return "";
        return JSON.stringify({
            type: 'POS_SALE',
            sellerWalletId: agent.id_wallet,
            amount: paymentInfo.total,
            currency: 'USD',
            saleReference: paymentInfo.reference,
            boutiqueName: paymentInfo.boutiqueName
        });
    }, [paymentInfo, agent.id_wallet]);

    return (
        <>
            <style>{`@media print { body > *:not(#printable-receipt) { visibility: hidden; } #printable-receipt, #printable-receipt * { visibility: visible; } #printable-receipt { position: absolute; left: 0; top: 0; width: 80mm; } @page { size: 80mm auto; margin: 0; } }`}</style>
            <div className="hidden"><div id="printable-receipt">{lastTransaction && <PosReceipt {...lastTransaction} />}</div></div>

            <QrScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={handleScanSuccess} mode="all" />
            
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Point de Vente (POS)</h1>
                    <Button variant="outline" size="sm" onClick={() => setIsScannerOpen(true)}>
                        <ScanLine className="mr-2 h-4 w-4" /> Scanner
                    </Button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <Card className="lg:col-span-2 shadow-sm">
                        <CardHeader>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    placeholder="Nom ou code-barres..."
                                    className="pl-10 h-12"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[600px]">
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pr-4">
                                    {filteredProducts.map(product => (
                                        <button key={product.id} onClick={() => handleAddToCart(product)} disabled={product.stock <= 0} className={cn("group text-left p-2 rounded-xl border hover:shadow-xl transition-all bg-card", product.stock === 0 && 'opacity-50')}>
                                            <div className="relative aspect-square w-full bg-muted rounded-lg overflow-hidden mb-2">
                                                <Image src={product.images ? product.images[0] : 'https://placehold.co/200x200.png'} alt={product.name} fill className="object-cover" />
                                                {product.stock <= 0 && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white font-bold text-xs uppercase">Épuisé</span></div>}
                                            </div>
                                            <p className="font-bold text-sm truncate">{product.name}</p>
                                            <p className="font-black text-primary">${product.sellingPrice.toFixed(2)}</p>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-1 sticky top-24 shadow-lg border-primary/10">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="flex items-center gap-2 text-primary"><ShoppingCart className="h-5 w-5" /> Panier</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {cart.length === 0 ? (
                                <div className="text-center text-muted-foreground py-20 border-2 border-dashed rounded-xl">
                                    <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-10" />
                                    <p className="text-sm font-medium">Panier vide</p>
                                </div>
                            ) : (
                                <>
                                    <ScrollArea className="h-[350px]">
                                        <div className="space-y-4 pr-4">
                                            {cart.map(item => (
                                                <div key={item.id} className="flex gap-4 items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                                    <Image src={item.images ? item.images[0] : 'https://placehold.co/56x56.png'} alt={item.name} width={40} height={40} className="rounded-md object-cover" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold truncate">{item.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                                                            <span className="font-black text-xs w-4 text-center">{item.quantity}</span>
                                                            <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                                                        </div>
                                                    </div>
                                                    <p className="font-black text-sm text-primary">${(currentPrice(item, item.quantity) * item.quantity).toFixed(2)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    <Separator className="my-6" />
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-muted-foreground text-sm font-medium">Total à percevoir</span>
                                        <span className="text-2xl font-black text-foreground">${cartTotal.toFixed(2)}</span>
                                    </div>
                                    <Button variant="gradient" className="w-full mt-8 h-14 text-lg font-black shadow-xl" onClick={handleCheckout}>ENCAISSER</Button>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
                <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Validation du paiement</DialogTitle>
                        <DialogDescription className="text-zinc-400">Total : <span className="font-bold text-primary">{paymentInfo?.total.toFixed(2)} USD</span></DialogDescription>
                    </DialogHeader>
                    <Tabs defaultValue="qr_code" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-zinc-800"><TabsTrigger value="qr_code">QR Code</TabsTrigger><TabsTrigger value="manual">Saisie Manuelle</TabsTrigger></TabsList>
                        <TabsContent value="qr_code" className="text-center space-y-6 pt-6">
                            <p className="text-sm text-zinc-400">Le client scanne ce code pour payer.</p>
                            <div className="bg-white p-6 rounded-2xl inline-block shadow-2xl"><QRCodeSVG value={paymentQRCodeValue} size={200} /></div>
                        </TabsContent>
                        <TabsContent value="manual" className="pt-6 space-y-6">
                            <Form {...manualPaymentForm}>
                                <form className="space-y-4">
                                    <FormField control={manualPaymentForm.control} name="walletId" render={({ field }) => (
                                        <FormItem><InternationalWalletInput field={field} onVerificationResult={setVerifiedClient} label="ID Portefeuille Client" /></FormItem>
                                    )} />
                                    {verifiedClient?.success && (
                                        <Button type="button" onClick={handleInitiateManualPayment} disabled={isSubmitting} variant="gradient" className="w-full h-12 font-bold">
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Demander validation
                                        </Button>
                                    )}
                                </form>
                            </Form>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
            
            <Dialog open={showOtpModal} onOpenChange={setShowOtpModal}>
                <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader><DialogTitle>Confirmation Client</DialogTitle></DialogHeader>
                    <Form {...otpForm}><form onSubmit={otpForm.handleSubmit(handleCodeConfirmation)} className="space-y-8 pt-6">
                        <FormField control={otpForm.control} name="code" render={({ field }) => (
                            <FormItem><FormLabel className="text-center block">Code reçu par le client</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={6} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>
                        )}/>
                        <Button type="submit" disabled={isSubmitting} className="w-full h-12 font-bold" variant="gradient">Confirmer la vente</Button>
                    </form></Form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!lastTransaction} onOpenChange={(isOpen) => !isOpen && closeReceiptAndReset()}>
                <DialogContent className="max-w-xs p-0 border-none bg-transparent shadow-none">
                    <PosReceipt {...lastTransaction!} />
                    <DialogFooter className="mt-4 bg-background p-4 rounded-b-xl border-t print:hidden">
                        <Button onClick={() => window.print()} className="w-full font-bold"><Printer className="mr-2 h-4 w-4" /> Imprimer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}