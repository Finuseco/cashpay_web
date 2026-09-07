
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { QrScannerDialog } from "@/components/shared/qr-scanner-dialog";
import type { User, Currency, CartItem, Product } from "@/lib/types";
import { PaymentConfirmationForm } from '@/components/pay/payment-confirmation-form';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { Button } from '@/components/ui/button';
import { ScanLine, Loader2, ShoppingCart, X, Minus, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { getProductById } from '@/lib/actions/shopping.actions';
import { currentPrice, generateReferenceCode } from '@/lib/utils';

// This type is for the state that can hold various scanned data structures
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

// This type is specifically for what gets passed to the PaymentConfirmationForm
type PaymentDataForForm = {
    type?: 'POS_SALE' | 'PAYMENT_REQUEST';
    saleReference?: string;
    sellerWalletId?: string;
    sellerName?: string;
    boutiqueName?: string;
    amount: number; 
    currency: string; 
    recipient?: string;
    items?: CartItem[];
} | null;


export default function PayPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userCurrencies, setUserCurrencies] = useState<Currency[]>([]);
  const { openAlert } = useAlertDialog();

  const [paymentData, setPaymentData] = useState<PaymentDataForForm>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isFetchingUser, setIsFetchingUser] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        setIsFetchingUser(true);
        const fetchedUser = await getAuthenticatedUser();
        setUser(fetchedUser);
        if (fetchedUser) {
            const fetchedCurrencies = await getUserCurrencies(fetchedUser.id);
            setUserCurrencies(fetchedCurrencies);
        }
        setIsFetchingUser(false);
    };
    fetchData();
  }, []);

  const handleScanSuccess = async (text: string) => {
    setIsScannerOpen(false);

    if (!user) {
        openAlert({ title: t('payWaitTitle'), description: t('payLoadingUserDescription'), variant: "info" });
        return;
    }

    // Regex for Sovereign Wallet ID (2 letters + 10 digits)
    const walletIdRegex = /^[A-Z]{2}\d{10}$/;

    try {
      // Try parsing as JSON first (Complex POS/Payment Request)
      const data: ScannedDataState = JSON.parse(text);

      // Case 1: Full Point of Sale (POS) QR Code (Direct Payment)
      if (data && data.type === 'POS_SALE' && data.sellerWalletId) {
        if ((!data.amount || data.amount === 0) && Array.isArray(data.items) && data.items.length > 0) {
            data.amount = data.items.reduce((sum, item) => {
                const p = Number(item.sellingPrice || (item as any).price || 0);
                const q = Number(item.quantity || 0);
                return sum + (p * q);
            }, 0);
        }
        if (data.amount && data.amount > 0 && data.currency) {
            setPaymentData(data as PaymentDataForForm);
            return;
        }
      }
      
      // Case 2: Simple Payment Request QR Code (Direct Payment)
      if (data && data.amount && data.currency && data.recipient) {
         setPaymentData({ ...data, type: 'PAYMENT_REQUEST' } as PaymentDataForForm);
         return;
      }

      // Case 3: Individual Product Scan (Add to cart)
      if (data && data.type === 'PRODUCT' && data.productId) {
        const product = await getProductById(data.productId);
        if (product) {
            setCartItems(prevItems => {
                const existingItem = prevItems.find(item => item.id === product.id);
                if (existingItem) {
                    return prevItems.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                }
                return [...prevItems, { ...product, quantity: 1 }];
            });
        } else {
             openAlert({ variant: "error", title: t('qrCodeInvalidTitle'), description: "Produit non trouvé dans le catalogue JoJo." });
        }
        return;
      }
    } catch (e) {
      // Fallback: If not JSON, check if it's a raw Wallet ID
      if (walletIdRegex.test(text)) {
        openAlert({ 
            variant: "info", 
            title: "Destinataire identifié",
            description: `Vous allez être redirigé vers l'écran de transfert pour le portefeuille ${text}.`,
            onClose: () => router.push(`/send?recipient=${text}`)
        });
        return;
      }
    }

    // If none of the above match, it's an invalid code
    openAlert({ 
        variant: "error", 
        title: t('qrCodeInvalidTitle'), 
        description: t('qrCodeInvalidDescription') 
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

  const handlePaymentSuccess = () => {
    openAlert({
      variant: 'success',
      title: t('paySuccessTitle'),
      description: t('paySuccessSimple'),
      onClose: () => {
        setPaymentData(null);
        setCartItems([]);
        router.push('/transactions');
      }
    });
  };
  
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
        const p = Number(item.sellingPrice || (item as any).price || 0);
        const q = Number(item.quantity || 0);
        return sum + (p * q);
    }, 0);
  }, [cartItems]);
  
  const cartCurrencySymbol = cartItems.length > 0 ? (cartItems[0].currency === 'EUR' ? '€' : '$') : '$';


  return (
    <DashboardLayout>
        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-md">
                {isFetchingUser ? (
                    <Card>
                        <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-4">
                            <Loader2 className="h-24 w-24 text-primary animate-spin" />
                            <p className="text-muted-foreground">{t('payLoadingUserData')}</p>
                        </CardContent>
                    </Card>
                ) : paymentData ? (
                    <PaymentConfirmationForm 
                        user={user}
                        paymentData={paymentData}
                        userCurrencies={userCurrencies}
                        onSuccess={handlePaymentSuccess}
                    />
                ) : (
                    <Card className="shadow-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary"><ShoppingCart /> Panier JoJo Market</CardTitle>
                            <CardDescription>Scannez les QR codes des produits ou les ID de portefeuilles.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {cartItems.length === 0 ? (
                                <div className="p-8 flex flex-col items-center justify-center text-center gap-4 border-2 border-dashed rounded-xl bg-muted/20">
                                    <ScanLine className="h-20 w-20 text-muted-foreground opacity-30" />
                                    <div>
                                        <p className="font-bold text-foreground">Votre panier est vide</p>
                                        <p className="text-xs text-muted-foreground mt-1">Scannez un produit en magasin ou l'ID d'un ami.</p>
                                    </div>
                                    <Button size="lg" variant="gradient" className="w-full font-bold shadow-lg" onClick={() => setIsScannerOpen(true)}>
                                        <ScanLine className="mr-2 h-5 w-5" />
                                        {t('payScannerTitle')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
                                      {cartItems.map(item => (
                                          <div key={item.id} className="flex gap-4 items-center p-2 rounded-lg bg-muted/30">
                                              <Image src={item.image} alt={item.name} width={56} height={56} className="rounded-md bg-muted object-cover" />
                                              <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-bold truncate text-foreground">{item.name}</p>
                                                  <div className="flex items-center gap-1 mt-1">
                                                      <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateCartQuantity(item.id, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                                                      <span className="font-black text-sm w-6 text-center">{item.quantity}</span>
                                                      <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateCartQuantity(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                                                  </div>
                                              </div>
                                              <p className="font-black text-sm text-primary">{item.currency === 'EUR' ? '€' : '$'}{(currentPrice(item, item.quantity) * item.quantity).toFixed(2)}</p>
                                          </div>
                                      ))}
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-muted-foreground font-medium">Total Commande</span>
                                        <span className="text-2xl font-black text-foreground">{cartCurrencySymbol}{cartTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button variant="outline" className="flex-1 h-12" onClick={() => setIsScannerOpen(true)}>
                                            <ScanLine className="mr-2 h-4 w-4" />
                                            Scanner
                                        </Button>
                                        <Button className="flex-1 h-12 font-bold shadow-lg" variant="gradient" onClick={handleCheckoutCart} disabled={cartItems.length === 0}>
                                            Payer
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
