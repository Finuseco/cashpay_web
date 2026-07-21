'use client';

import { useState } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  MinusCircle,
  PlusCircle,
  Ban,
  CreditCard,
  Smartphone,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { InputWithIcon } from '@/components/ui/input-with-icon';
import { cn } from '@/lib/utils';
import { recordSale } from '@/actions/pos.actions';
import type { Product } from '@/lib/types';

// --- Données Fictives (à remplacer par des données de l'API) ---
const currentStoreId = 1;
const currentUserId = 2; 
const currentSessionId = 1;

const availableProducts: (Product & { storeId: number; store: string, image: string })[] = [
    { product_id: 1, name: 'Doliprane 1000mg', selling_price: 3500, stock: { quantity: 50 }, sku: 'PROD001', image: '/placeholder.svg', storeId: 1, store: 'Pharmacie Centrale' },
    { product_id: 2, name: 'Eau Minérale 1.5L', selling_price: 1500, stock: { quantity: 120 }, sku: 'PROD002', image: '/placeholder.svg', storeId: 1, store: 'Pharmacie Centrale' },
    { product_id: 3, name: 'Stylo Bic Bleu', selling_price: 500, stock: { quantity: 300 }, sku: 'PROD003', image: '/placeholder.svg', storeId: 2, store: 'Supermarché du Port' },
    { product_id: 4, name: 'Cahier 200p', selling_price: 2500, stock: { quantity: 80 }, sku: 'PROD004', image: '/placeholder.svg', storeId: 1, store: 'Pharmacie Centrale' },
    { product_id: 5, name: 'Savon de Marseille', selling_price: 4000, stock: { quantity: 0 }, sku: 'PROD005', image: '/placeholder.svg', storeId: 1, store: 'Pharmacie Centrale' },
    { product_id: 6, name: 'Pain de blé complet', selling_price: 2000, stock: { quantity: 40 }, sku: 'PROD006', image: '/placeholder.svg', storeId: 2, store: 'Supermarché du Port' },
    { product_id: 7, name: 'Paracétamol 500mg', selling_price: 2800, stock: { quantity: 75 }, sku: 'PROD007', image: '/placeholder.svg', storeId: 3, store: 'Magasin de la Cité' },
  ].map(p => ({
      ...p,
      purchase_price: p.selling_price * 0.8,
      unit: 'pièce',
      created_at: new Date(),
      updated_at: new Date(),
  }));


type CartItem = {
    productId: number;
    name: string;
    quantity: number;
    price: number;
};

export default function PosPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | null>(null);

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const taxes = subtotal * 0.16; // TVA Simulé à 16%
  const total = subtotal + taxes;

  const handleAddToCart = (product: Product & { storeId: number }) => {
    if (product.storeId !== currentStoreId || product.stock.quantity === 0) return;

    setCartItems(prevItems => {
        const existingItem = prevItems.find(item => item.productId === product.product_id);
        if (existingItem) {
            return prevItems.map(item =>
                item.productId === product.product_id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            );
        }
        return [...prevItems, { productId: product.product_id, name: product.name, quantity: 1, price: product.selling_price }];
    });
  };

  const handleUpdateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
        setCartItems(prevItems => prevItems.filter(item => item.productId !== productId));
    } else {
        setCartItems(prevItems => prevItems.map(item =>
            item.productId === productId ? { ...item, quantity: newQuantity } : item
        ));
    }
  };
  
  const handleClearCart = () => {
    setCartItems([]);
    setPaymentMethod(null);
  }

  const handleRecordSale = async () => {
    if (cartItems.length === 0 || !paymentMethod) {
      alert("Le panier est vide ou aucune méthode de paiement n'a été sélectionnée.");
      return;
    }
    
    const formData = new FormData();
    formData.append('session_id', currentSessionId.toString());
    formData.append('user_id', currentUserId.toString());
    formData.append('store_id', currentStoreId.toString());
    formData.append('total_amount', total.toString());
    formData.append('payment_method', paymentMethod);
    formData.append('items', JSON.stringify(cartItems));

    const result = await recordSale(formData);
    alert(result.message); // Pour la démo, on utilise une alerte
    if(result.message.includes("enregistrée")){
      handleClearCart();
    }
  };


  return (
    <div className="flex h-screen bg-muted/40">
      {/* Colonne Principale (Produits) */}
      <div className="flex flex-col w-3/4 p-4 gap-4">
        <header className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Point de Vente</h1>
            <div className='w-full max-w-md'>
                 <InputWithIcon
                    icon={<Search className="h-4 w-4" />}
                    placeholder="Scanner ou rechercher un produit par nom/SKU..."
                />
            </div>
        </header>

        <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {availableProducts.map((product) => {
              const isFromCurrentStore = product.storeId === currentStoreId;
              const isOutOfStock = product.stock.quantity === 0;

              return (
                <Card 
                  key={product.product_id}
                  onClick={() => handleAddToCart(product)}
                  className={cn(
                    "overflow-hidden transition-shadow relative",
                    isFromCurrentStore && !isOutOfStock ? "cursor-pointer hover:shadow-lg" : "cursor-not-allowed bg-muted/60"
                  )}
                >
                    {!isFromCurrentStore && (
                      <div className="absolute inset-0 bg-black/30 z-10 flex items-center justify-center p-2 text-center">
                         <Ban className="h-8 w-8 text-white" />
                      </div>
                    )}
                    <div className={cn("relative w-full h-24 bg-muted", !isFromCurrentStore ? 'opacity-50' : '')}>
                        <Image src={product.image} alt={product.name} layout="fill" objectFit="cover" />
                        {isOutOfStock && isFromCurrentStore && (
                           <Badge variant="destructive" className="absolute top-2 left-2 z-20">Rupture</Badge>
                        )}
                    </div>
                    <CardContent className={cn("p-3", !isFromCurrentStore ? 'opacity-50' : '')}>
                        <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">{product.selling_price.toLocaleString('fr-CD')} CDF</p>
                        
                        {!isFromCurrentStore ? (
                          <Badge variant="outline" className="mt-2 text-xs">
                             Dispo: {product.store}
                          </Badge>
                        ) : (
                          <Badge variant={product.stock.quantity > 20 ? 'secondary' : 'destructive'} className="mt-2 text-xs">
                             Stock: {product.stock.quantity}
                          </Badge>
                        )}
                    </CardContent>
                </Card>
            )})}
            </div>
        </div>

      </div>

      {/* Colonne de Droite (Panier) */}
      <div className="w-1/4 bg-background border-l flex flex-col">
        <Card className="flex-1 flex flex-col rounded-none border-none">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className='flex items-center gap-2'>
                <ShoppingCart className="h-5 w-5" />
                Vente en cours
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUpdateQuantity(0,0)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            <Table>
              <TableBody>
                {cartItems.map((item) => (
                  <TableRow key={item.productId}>
                    <TableCell className="py-2 px-4">
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <MinusCircle className="h-4 w-4 cursor-pointer" onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)} />
                            <span>{item.quantity}</span>
                            <PlusCircle className="h-4 w-4 cursor-pointer" onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)} />
                        </div>
                    </TableCell>
                    <TableCell className="py-2 px-4 text-right font-semibold">
                        {(item.quantity * item.price).toLocaleString('fr-CD')} CDF
                    </TableCell>
                  </TableRow>
                ))}
                {cartItems.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                            Le panier est vide.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 p-4 border-t">
             <div className="w-full text-sm">
                <div className="flex justify-between">
                    <span>Sous-total</span>
                    <span>{subtotal.toLocaleString('fr-CD')} CDF</span>
                </div>
                 <div className="flex justify-between">
                    <span>TVA (16%)</span>
                    <span>{taxes.toLocaleString('fr-CD')} CDF</span>
                </div>
                 <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t">
                    <span>Total</span>
                    <span>{total.toLocaleString('fr-CD')} CDF</span>
                </div>
             </div>
             <div>
                <span className="text-sm font-medium">Méthode de paiement</span>
                <div className="grid grid-cols-3 gap-2 w-full mt-2">
                    <Button variant={paymentMethod === 'cash' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('cash')}>
                        <DollarSign className="mr-2 h-4 w-4"/> Cash
                    </Button>
                    <Button variant={paymentMethod === 'card' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('card')}>
                        <CreditCard className="mr-2 h-4 w-4"/> Carte
                    </Button>
                    <Button variant={paymentMethod === 'mobile' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('mobile')}>
                        <Smartphone className="mr-2 h-4 w-4"/> Mobile
                    </Button>
                </div>
             </div>
            <div className="grid grid-cols-2 gap-2 w-full">
                <Button variant="outline" onClick={handleClearCart}>Annuler</Button>
                <Button onClick={handleRecordSale} disabled={cartItems.length === 0 || !paymentMethod}>Payer</Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
