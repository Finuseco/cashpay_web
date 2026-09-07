
'use client';

import { useState } from 'react';
import { Search, ShoppingCart, CreditCard, Smartphone, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { InputWithIcon } from '@/components/ui/input-with-icon';
import { recordSale } from '@/lib/actions/pos.actions';

export default function PosPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | null>(null);

  const total = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleRecordSale = async () => {
    const formData = new FormData();
    formData.append('total_amount', total.toString());
    formData.append('items', JSON.stringify(cartItems));
    const result = await recordSale(formData);
    alert(result.message);
  };

  return (
    <div className="flex h-screen bg-muted/40 p-4 gap-4">
      <div className="flex-1">
        <header className="mb-4">
            <InputWithIcon icon={<Search className="h-4 w-4" />} placeholder="Rechercher un produit..." />
        </header>
        <div className="text-center py-20 text-muted-foreground">Sélectionnez des produits...</div>
      </div>
      <Card className="w-80 flex flex-col">
        <CardHeader><CardTitle>Panier</CardTitle></CardHeader>
        <CardContent className="flex-1">Vide</CardContent>
        <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" variant="gradient" onClick={handleRecordSale}>Valider ${total}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
