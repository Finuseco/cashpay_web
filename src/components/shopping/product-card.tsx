
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Product, User, Currency } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getExchangeRatesForCountry } from '@/lib/actions/exchange.actions';
import { countryToCode, currentPrice, cn } from '@/lib/utils';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { ShieldAlert } from 'lucide-react';

export function ProductCard({ product }: { product: Product }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [localRate, setLocalRate] = useState<number | null>(null);
  const [localCurrency, setLocalCurrency] = useState<Currency | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = await getAuthenticatedUser();
      setCurrentUser(user);

      if (user?.country) {
        const userCountryCode = countryToCode(user.country);
        if (userCountryCode) {
            const userCurrencies = await getUserCurrencies(user.id);
            const local = userCurrencies.find(c => c.code !== 'USD' && c.code !== 'EUR');
            setLocalCurrency(local || null);

            const rates = await getExchangeRatesForCountry(userCountryCode);
            const rateObject = rates.find((r) => r.from_currency === product.currency && r.to_currency === local?.code); 
            if (rateObject) {
              setLocalRate(rateObject.rate);
            }
        }
      }
    };
    fetchUserData();
  }, [product.currency, product.id]);

  const price = currentPrice(product, 1); // Get base price
  const code = countryToCode(product.countryCode);
  const isSellerInactive = product.sellerSubscriptionStatus === 'inactive';
  
  return (
    <Link href={`/shopping/${product.id}`} className={cn("group block", isSellerInactive && "opacity-70 grayscale")}>
      <Card className="overflow-hidden h-full flex flex-col">
        <div className="relative aspect-square w-full bg-muted">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            data-ai-hint="product image"
          />
           {product.stock === 0 ? (
             <Badge variant="destructive" className="absolute top-2 right-2 font-black uppercase text-[10px]">Épuisé</Badge>
           ) : isSellerInactive ? (
             <Badge variant="outline" className="absolute top-2 right-2 bg-red-100 text-red-700 border-red-300 font-bold text-[10px] uppercase">Vendeur Inactif</Badge>
           ) : null}
           
           {!product.isPublic && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <ShieldAlert className="h-12 w-12 text-white/50" />
              </div>
           )}
        </div>
        <CardContent className="p-3 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm leading-tight truncate group-hover:text-primary">
              {product.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                {code && (
                  <Image 
                    src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`} 
                    alt={code} 
                    width={16} 
                    height={12}
                    className="shrink-0"
                  />
                )}
                <span className="truncate">{product.boutiqueName || 'Vendeur Indépendant'}</span>
            </div>
          </div>
          <div className='mt-2'>
            <p className="font-bold text-lg">{product.currency === 'EUR' ? '€' : '$'}{price.toFixed(2)}</p>
             {localCurrency && localRate && (
                <p className="text-[10px] text-muted-foreground font-bold">
                    ≈ {(price * localRate).toLocaleString('fr-FR', { style: 'currency', currency: localCurrency.code, minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
