'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { CartItem, User, Order, ProductVariation, Address } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronRight, Check, Minus, Plus, MessageSquare, Loader2, ShoppingCart, Home, Truck, Store as StoreIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Link from 'next/link';
import { createOrder, getUserCart, updateUserCart } from '@/lib/actions/shopping.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserAddresses } from '@/lib/actions/address.actions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { currentPrice } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const CircleCheckbox = ({ checked, onCheckedChange }: { checked: boolean, onCheckedChange: (checked: boolean) => void }) => (
    <button
        onClick={() => onCheckedChange(!checked)}
        className={cn(
            "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
            checked ? "bg-primary border-primary" : "border-gray-400 bg-transparent"
        )}
    >
        {checked && <Check className="h-3 w-3 text-white" />}
    </button>
);

const SellerGroup = ({
    sellerName,
    items,
    selectedItems,
    onSellerToggle,
    onItemToggle,
    onQuantityChange
}: {
    sellerName: string;
    items: CartItem[];
    selectedItems: Set<string>;
    onSellerToggle: (sellerName: string, isSelected: boolean) => void;
    onItemToggle: (itemId: string, isSelected: boolean) => void;
    onQuantityChange: (itemId: string, newQuantity: number) => void;
}) => {
    const areAllItemsSelected = items.every(item => selectedItems.has(item.id));
    const sellerWalletId = items[0]?.sellerWalletId;

    return (
        <div className="bg-background rounded-lg p-3 shadow-sm border border-zinc-100">
            <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                    <CircleCheckbox checked={areAllItemsSelected} onCheckedChange={(checked) => onSellerToggle(sellerName, checked)} />
                    <span className="font-semibold text-foreground">{sellerName}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                 {sellerWalletId && (
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <Link href={`/feedback?contactId=${sellerWalletId}`}>
                            <MessageSquare className="h-4 w-4" />
                        </Link>
                    </Button>
                )}
            </div>
            <div className="space-y-4">
                {items.map(item => (
                    <div key={item.id} className="flex items-start gap-3 border-t border-zinc-50 pt-4 first:border-0 first:pt-0">
                        <CircleCheckbox checked={selectedItems.has(item.id)} onCheckedChange={(checked) => onItemToggle(item.id, checked)} />
                        <div className="relative h-20 w-20 shrink-0">
                            <Image src={item.image} alt={item.name} fill className="rounded-md bg-muted object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm line-clamp-2 text-foreground font-medium">{item.name}</p>
                            <p className="font-bold text-base mt-1 text-primary">${currentPrice(item, item.quantity).toFixed(2)}</p>
                            <div className="flex items-center border rounded-md w-fit mt-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onQuantityChange(item.id, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                                <span className="px-2 text-foreground text-sm font-bold min-w-[2rem] text-center">{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onQuantityChange(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PinFormSchema = z.object({
    pin: z.string().length(4, { message: "Le PIN doit contenir 4 chiffres." }),
    shippingAddressId: z.string().optional(),
    wantsShipping: z.boolean().default(true),
});

export function CartClient() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const { openAlert } = useAlertDialog();
    
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [vatAmount, setVatAmount] = useState(0);

    const pinForm = useForm<z.infer<typeof PinFormSchema>>({
        resolver: zodResolver(PinFormSchema),
        defaultValues: { pin: "", shippingAddressId: "", wantsShipping: true },
    });
    
    const wantsShipping = pinForm.watch('wantsShipping');

    const fetchData = useCallback(async (userId: number) => {
        setIsLoading(true);
        const [items, userAddresses] = await Promise.all([
            getUserCart(userId),
            getUserAddresses(userId)
        ]);
        
        setCartItems(items);
        setSelectedIds(new Set(items.map(i => i.id)));
        setAddresses(userAddresses);
        
        if (userAddresses.length > 0) {
            pinForm.setValue('shippingAddressId', userAddresses[0].id.toString());
        }
        
        setIsLoading(false);
    }, [pinForm]);

    useEffect(() => {
        const load = async () => {
            const u = await getAuthenticatedUser();
            if (u) {
                setUser(u);
                fetchData(u.id);
            } else {
                router.push('/login');
            }
        };
        load();
    }, [router, fetchData]);

    const handleItemToggle = (id: string, select: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (select) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleSellerToggle = (name: string, select: boolean) => {
        const ids = groupedBySeller[name].map(i => i.id);
        setSelectedIds(prev => {
            const next = new Set(prev);
            ids.forEach(id => select ? next.add(id) : next.delete(id));
            return next;
        });
    };

    const handleQuantityChange = async (id: string, qty: number) => {
        if (!user) return;
        const res = await updateUserCart(user.id, id, qty);
        if (res.success && res.cart) {
            setCartItems(res.cart);
            window.dispatchEvent(new Event('jojo-cart-updated'));
        }
    };

    const calculation = useMemo(() => {
        const selectedItems = cartItems.filter(item => selectedIds.has(item.id));
        if (selectedItems.length === 0) return { subtotal: 0, weight: 0, shipping: 0, currency: 'USD' };
        
        const subtotal = selectedItems.reduce((s, i) => s + currentPrice(i, i.quantity) * i.quantity, 0);
        const weight = selectedItems.reduce((s, i) => s + (i.weight || 0) * i.quantity, 0);
        
        const shippingRate = selectedItems.find(i => i.shippingRates && i.shippingRates.length > 0)?.shippingRates?.[0]?.pricePerKg || 0;
        const shipping = weight * shippingRate;
        
        return { subtotal, weight, shipping, currency: selectedItems[0]?.currency || 'USD' };
    }, [cartItems, selectedIds]);

    useEffect(() => {
        const loadVat = async () => {
            if (calculation.subtotal > 0 && user) {
                const amountForVat = calculation.subtotal + (wantsShipping ? calculation.shipping : 0);
                const vat = await calculateTransactionFee(amountForVat, calculation.currency, 'PRODUCT_SALE_VAT', user.country);
                setVatAmount(vat);
            } else { setVatAmount(0); }
        };
        loadVat();
    }, [calculation, user, wantsShipping]);

    const finalShippingCost = wantsShipping ? calculation.shipping : 0;
    const total = calculation.subtotal + finalShippingCost + vatAmount;

    const groupedBySeller = useMemo(() => {
        return cartItems.reduce((acc, item) => {
            const name = item.seller.name;
            if (!acc[name]) acc[name] = [];
            acc[name].push(item);
            return acc;
        }, {} as Record<string, CartItem[]>);
    }, [cartItems]);

    const handleCheckout = () => {
        if (selectedIds.size === 0) return;
        setIsCheckoutOpen(true);
    };

    const onPinConfirm = async (values: z.infer<typeof PinFormSchema>) => {
        if (!user) return;
        
        if (values.wantsShipping && !values.shippingAddressId) {
            openAlert({ title: "Adresse requise", description: "Veuillez sélectionner une adresse pour la livraison.", variant: 'warning' });
            return;
        }

        setIsProcessing(true);
        const items = cartItems.filter(i => selectedIds.has(i.id));
        const res = await createOrder({
            user, items, totalPrice: total, currency: calculation.currency,
            pin: values.pin, shippingCost: finalShippingCost, vatAmount,
            shippingAddressId: values.wantsShipping ? values.shippingAddressId : undefined
        });
        setIsProcessing(false);
        if (res.success) {
            setIsCheckoutOpen(false);
            openAlert({ 
                variant: 'success', 
                title: 'Commande confirmée', 
                description: 'Votre paiement a été traité avec succès et votre commande est en cours de préparation.',
                onClose: () => router.push('/shopping/orders') 
            });
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: res.error || "Le paiement a échoué." });
        }
    };

    if (isLoading) return (
        <div className="p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );

    return (
        <div className="bg-muted text-foreground min-h-screen pb-32">
            <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Valider la Commande</DialogTitle></DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <Form {...pinForm}>
                            <form onSubmit={pinForm.handleSubmit(onPinConfirm)} className="space-y-6">
                                
                                <div className="space-y-4">
                                    <FormField
                                        control={pinForm.control}
                                        name="wantsShipping"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base flex items-center gap-2">
                                                        {field.value ? <Truck className="h-5 w-5 text-primary" /> : <StoreIcon className="h-5 w-5 text-zinc-400" />}
                                                        {field.value ? "Livraison à domicile" : "Récupération sur place"}
                                                    </FormLabel>
                                                    <p className="text-xs text-muted-foreground">
                                                        {field.value ? "Le vendeur livrera votre colis." : "Vous récupérerez votre colis au magasin."}
                                                    </p>
                                                </div>
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {wantsShipping && (
                                        <FormField
                                            control={pinForm.control}
                                            name="shippingAddressId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Adresse de livraison</FormLabel>
                                                    {addresses.length > 0 ? (
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Choisir une adresse" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {addresses.map(addr => (
                                                                    <SelectItem key={addr.id} value={addr.id.toString()}>
                                                                        {addr.label} ({addr.city})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <p className="text-xs text-destructive">Aucune adresse trouvée.</p>
                                                            <Button asChild variant="outline" size="sm" className="w-full">
                                                                <Link href="/shopping/address">Ajouter une adresse</Link>
                                                            </Button>
                                                        </div>
                                                    )}
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>

                                <div className="space-y-2 p-3 bg-muted rounded-lg text-sm">
                                    <div className="flex justify-between"><span>Produits ({selectedIds.size})</span><span>${calculation.subtotal.toFixed(2)}</span></div>
                                    <div className={cn("flex justify-between transition-opacity", !wantsShipping && "opacity-30 line-through")}>
                                        <span>Livraison</span>
                                        <span>${calculation.shipping.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between"><span>TVA</span><span>${vatAmount.toFixed(2)}</span></div>
                                    <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2 text-primary">
                                        <span>Total</span>
                                        <span>${total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <FormField control={pinForm.control} name="pin" render={({field}) => (
                                    <FormItem>
                                        <FormLabel className="text-center block">Entrez votre PIN de sécurité</FormLabel>
                                        <FormControl>
                                            <div className="flex justify-center">
                                                <InputOTP maxLength={4} {...field}>
                                                    <InputOTPGroup>
                                                        <InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/>
                                                    </InputOTPGroup>
                                                </InputOTP>
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )} />

                                <Button type="submit" variant="gradient" className="w-full h-12 font-bold" disabled={isProcessing}>
                                    {isProcessing && <Loader2 className="animate-spin mr-2 h-4 w-4"/>} Payer ${total.toFixed(2)}
                                </Button>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>

            <header className="sticky top-0 bg-background shadow-sm p-4 z-10 flex justify-between items-center">
                <h1 className="text-lg font-bold">Mon Panier ({cartItems.length})</h1>
                {selectedIds.size > 0 && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setSelectedIds(new Set())} 
                        className="text-destructive"
                    >
                        <Trash2 className="h-5 w-5"/>
                    </Button>
                )}
            </header>

            <main className="p-2 space-y-3">
                {cartItems.length > 0 ? Object.entries(groupedBySeller).map(([name, items]) => (
                    <SellerGroup 
                        key={name} 
                        sellerName={name} 
                        items={items} 
                        selectedItems={selectedIds} 
                        onItemToggle={handleItemToggle}
                        onSellerToggle={handleSellerToggle}
                        onQuantityChange={handleQuantityChange}
                    />
                )) : (
                    <div className="text-center py-20 text-muted-foreground flex flex-col items-center gap-4">
                        <ShoppingCart className="h-16 w-16 opacity-20" />
                        <p>Votre panier est vide</p>
                        <Button asChild variant="outline"><Link href="/shopping/home">Commencer mes achats</Link></Button>
                    </div>
                )}
            </main>

            {cartItems.length > 0 && (
                <footer className="fixed bottom-16 left-0 right-0 bg-background border-t p-3 flex justify-between items-center z-20">
                    <div className="flex items-center gap-2">
                        <CircleCheckbox checked={selectedIds.size === cartItems.length && cartItems.length > 0} onCheckedChange={(checked) => {
                            if (checked) setSelectedIds(new Set(cartItems.map(i => i.id)));
                            else setSelectedIds(new Set());
                        }} />
                        <div>
                            <span className="text-xs text-muted-foreground">Total estimé</span>
                            <p className="text-xl font-bold text-primary">${total.toFixed(2)}</p>
                        </div>
                    </div>
                    <Button onClick={handleCheckout} disabled={selectedIds.size === 0} className="rounded-full px-8 h-12 text-lg font-bold shadow-lg" variant="gradient">
                        Commander ({selectedIds.size})
                    </Button>
                </footer>
            )}
        </div>
    );
}
