
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import { QrScannerDialog } from "@/components/shared/qr-scanner-dialog";
import type { User, Currency, CartItem, Product } from "@/lib/types";
import { PaymentConfirmationForm } from '@/components/pay/payment-confirmation-form';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { Button } from '@/components/ui/button';
import { ScanLine, Loader2, ShoppingCart, X, Minus, Plus, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { getProductById } from '@/lib/actions/shopping.actions';
import { currentPrice, generateReferenceCode } from '@/lib/utils';

// Types locaux pour la gestion sécurisée du scan
type ScannedDataState = {
    type?: 'POS_SALE' | 'PAYMENT_REQUEST' | 'PRODUCT';
    saleReference?: string;
    sellerWalletId?: string;
    sellerName?: string;
    boutiqueName?: string;
    amount?: number;
    currency?: string;
    recipient?: string;
    items?: CartItem[];
    productId?: string;
} | null;

export default function PayPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userCurrencies, setUserCurrencies] = useState<Currency[]>([]);
  const { openAlert } = useAlertDialog();

  const [paymentData, setPaymentData] = useState<ScannedDataState>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isFetchingUser, setIsFetchingUser] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
        setIsFetchingUser(true);
        try {
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            if (fetchedUser) {
                const fetchedCurrencies = await getUserCurrencies(fetchedUser.id);
                setUserCurrencies(fetchedCurrencies);
            }
        } catch (e) {
            console.error("Error loading pay page data", e);
        } finally {
            setIsFetchingUser(false);
        }
    };
    fetchData();
  }, []);

  const handleScanSuccess = async (text: string) => {
    setIsScannerOpen(false);

    if (!user) {
        openAlert({ 
            title: "Connexion requise", 
            description: "Veuillez attendre que votre profil soit chargé avant de scanner.", 
            variant: "info" 
        });
        return;
    }

    const walletIdRegex = /^[A-Z]{2}\d{10}$/;

    try {
      // Tentative de parsing JSON pour les QR complexes
      const data: ScannedDataState = JSON.parse(text);

      // Cas 1: Vente POS (Directe)
      if (data && data.type === 'POS_SALE' && data.sellerWalletId) {
        let calculatedAmount = data.amount || 0;
        if (calculatedAmount === 0 && Array.isArray(data.items)) {
            calculatedAmount = data.items.reduce((sum, item) => {
                const p = Number(item.sellingPrice || (item as any).price || 0);
                const q = Number(item.quantity || 0);
                return sum + (p * q);
            }, 0);
        }
        
        if (calculatedAmount > 0 && data.currency) {
            setPaymentData({ ...data, amount: calculatedAmount });
            return;
        }
      }
      
      // Cas 2: Demande de paiement simple
      if (data && data.amount && data.currency && data.recipient) {
         setPaymentData({ ...data, type: 'PAYMENT_REQUEST' });
         return;
      }

      // Cas 3: Scan produit individuel (Ajout panier)
      if (data && data.type === 'PRODUCT' && data.productId) {
        const product = await getProductById(data.productId);
        if (product) {
            setCartItems(prevItems => {
                const existingItem = prevItems.find(item => item.id === product.id);
                if (existingItem) {
                    return prevItems.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                }
                return [...prevItems, { ...product, quantity: 1 } as CartItem];
            });
            openAlert({ title: "Produit ajouté", description: `${product.name} a été ajouté au panier.`, variant: 'success' });
        } else {
             openAlert({ variant: "error", title: "Inconnu", description: "Ce produit n'existe pas dans le catalogue JoJo." });
        }
        return;
      }
    } catch (e) {
      // Fallback: Si ce n'est pas du JSON, c'est peut-être un ID Wallet brut
      if (walletIdRegex.test(text)) {
        openAlert({ 
            variant: "info", 
            title: "Destinataire identifié",
            description: `Voulez-vous effectuer un transfert vers ${text} ?`,
            showCancel: true,
            onClose: (confirmed) => {
                if (confirmed) router.push(`/send?recipient=${text}`);
            }
        });
        return;
      }
    }

    openAlert({ 
        variant: "error", 
        title: "Code invalide", 
        description: "Ce code n'est pas reconnu par le système CashPay." 
    });
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    setCartItems(prevItems => {
        if (newQuantity <= 0) {
            return prevItems.filter(item => item.id !== productId);
        }
        return prevItems.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item);
    });
  };

  const handleCheckoutCart = () => {
    if (cartItems.length === 0) return;

    const firstItem = cartItems[0];
    const totalAmount = cartItems.reduce((sum, item) => {
        const p = Number(item.sellingPrice || (item as any).price || 0);
        const q = Number(item.quantity || 0);
        return sum + (p * q);
    }, 0);
    
    setPaymentData({
        type: 'POS_SALE',
        saleReference: generateReferenceCode('SALE'),
        sellerWalletId: firstItem.sellerWalletId,
        sellerName: firstItem.seller.name,
        boutiqueName: firstItem.boutiqueName,
        amount: totalAmount,
        currency: firstItem.currency,
        items: cartItems,
    });
  };

  const handlePaymentClose = () => {
    setPaymentData(null);
    setCartItems([]);
  };

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
        const p = Number(item.sellingPrice || (item as any).price || 0);
        const q = Number(item.quantity || 0);
        return sum + (p * q);
    }, 0);
  }, [cartItems]);
  
  if (!mounted) return null;

  return (
    <DashboardLayout>
        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-md">
                {isFetchingUser ? (
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-4">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sécurisation du tunnel...</p>
                        </CardContent>
                    </Card>
                ) : paymentData && user ? (
                    <PaymentConfirmationForm 
                        user={user}
                        paymentData={paymentData as any}
                        userCurrencies={userCurrencies}
                        onSuccess={handlePaymentClose}
                    />
                ) : (
                    <Card className="shadow-xl rounded-3xl overflow-hidden border-none bg-white">
                        <CardHeader className="bg-primary/5 border-b border-primary/10 text-center py-6">
                            <CardTitle className="flex items-center justify-center gap-2 text-primary font-black uppercase tracking-tight">
                                <ShoppingCart className="h-5 w-5" /> Panier JoJo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {cartItems.length === 0 ? (
                                <div className="p-8 flex flex-col items-center justify-center text-center gap-6">
                                    <div className="h-24 w-24 bg-zinc-100 rounded-full flex items-center justify-center">
                                        <ScanLine className="h-12 w-12 text-zinc-300" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground">Prêt pour le paiement</p>
                                        <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">Scannez un QR code de prix en magasin ou l'ID d'un ami pour payer.</p>
                                    </div>
                                    <Button size="lg" variant="gradient" className="w-full font-black h-14 text-lg shadow-xl" onClick={() => setIsScannerOpen(true)}>
                                        <ScanLine className="mr-2 h-6 w-6" />
                                        OUVRIR LE SCANNER
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="max-h-64 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                      {cartItems.map(item => (
                                          <div key={item.id} className="flex gap-4 items-center p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                                              <div className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-white">
                                                <Image src={item.image} alt={item.name} fill className="object-cover" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-bold truncate text-foreground leading-tight">{item.name}</p>
                                                  <div className="flex items-center gap-2 mt-1">
                                                      <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="h-6 w-6 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-200"><Minus className="h-3 w-3" /></button>
                                                      <span className="font-black text-xs min-w-[20px] text-center">{item.quantity}</span>
                                                      <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="h-6 w-6 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-200"><Plus className="h-3 w-3" /></button>
                                                  </div>
                                              </div>
                                              <p className="font-black text-sm text-primary">${(currentPrice(item, item.quantity) * item.quantity).toFixed(2)}</p>
                                          </div>
                                      ))}
                                    </div>
                                    <Separator className="my-4"/>
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Total Panier</span>
                                        <span className="text-2xl font-black text-foreground">${cartTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button variant="outline" className="flex-1 h-14 rounded-2xl font-bold border-zinc-200" onClick={() => setIsScannerOpen(true)}>
                                            <ScanLine className="mr-2 h-4 w-4" />
                                            CONTINUER
                                        </Button>
                                        <Button className="flex-1 h-14 rounded-2xl font-black shadow-xl" variant="gradient" onClick={handleCheckoutCart}>
                                            PAYER MAINTENANT
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
             <QrScannerDialog
                open={isScannerOpen}
                onOpenChange={setIsScannerOpen}
                onScanSuccess={handleScanSuccess}
            />
        </main>
    </DashboardLayout>
  );
}
