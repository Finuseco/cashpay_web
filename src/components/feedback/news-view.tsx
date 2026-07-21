'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShoppingBag, Globe, Store } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ActivityCard } from '@/components/monpays/activity-card';
import { getCompanies, getActivities } from '@/lib/actions/monpays.actions';
import { getPublicProducts } from '@/lib/actions/shopping.actions';
import type { MonPaysCompany, MonPaysActivity, Product } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import Image from 'next/image';
import Link from 'next/link';

const NewsLoadingSkeleton = () => (
    <div className="p-4 space-y-4">
        <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
    </div>
);

const ProductNewsCard = ({ product }: { product: Product }) => (
    <Card className="overflow-hidden border-zinc-700 bg-zinc-800 text-white group">
        <Link href={`/shopping/${product.id}`}>
            <div className="relative aspect-video">
                <Image src={product.image} alt={product.name} fill className="object-cover transition-transform group-hover:scale-105" />
                <div className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                    JOJO MARKET
                </div>
            </div>
            <CardContent className="p-4">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <Store className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase">{product.boutiqueName || 'Boutique Certifiée'}</span>
                        </div>
                        <h3 className="font-bold text-sm line-clamp-1">{product.name}</h3>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-black text-primary">${product.sellingPrice.toFixed(2)}</p>
                    </div>
                </div>
                <Button variant="outline" className="w-full mt-3 h-8 text-xs border-zinc-600 hover:bg-zinc-700">
                    <ShoppingBag className="mr-2 h-3 w-3"/> Acheter sur JoJo
                </Button>
            </CardContent>
        </Link>
    </Card>
)

export function NewsView({ onBack }: { onBack: () => void }) {
    const [companies, setCompanies] = useState<MonPaysCompany[]>([]);
    const [activities, setActivities] = useState<MonPaysActivity[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const [fetchedCompanies, fetchedActivities, fetchedProducts] = await Promise.all([
                getCompanies(),
                getActivities(),
                getPublicProducts()
            ]);
            setCompanies(fetchedCompanies);
            setActivities(fetchedActivities);
            setProducts(fetchedProducts);
            setIsLoading(false);
        };
        fetchData();
    }, []);
    
    const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies]);

    const combinedFeed = useMemo(() => {
        const feed: (({ type: 'activity' } & MonPaysActivity) | ({ type: 'product' } & Product))[] = [
            ...activities.map(a => ({ ...a, type: 'activity' as const })),
            ...products.map(p => ({ ...p, type: 'product' as const }))
        ];
        
        return feed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [activities, products]);

    return (
        <div className="flex flex-col h-full bg-[#111827] text-white">
            <header className="flex items-center p-2 sm:p-3 shrink-0 bg-[#1f2c33] border-b border-zinc-700/50">
                <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>
                <h2 className="font-bold text-lg ml-4">Actualités & Tendances</h2>
            </header>
            
            {isLoading ? <NewsLoadingSkeleton /> : (
                <ScrollArea className="flex-1">
                    <div className="p-2 md:p-4 space-y-4 pb-20">
                        {combinedFeed.map((item, idx) => {
                            if (item.type === 'activity') {
                                const company = companyMap.get(item.companyId.toString());
                                if (!company) return null;
                                return <ActivityCard key={`act-${item.id}`} activity={item} company={company} />;
                            } else {
                                return <ProductNewsCard key={`prod-${item.id}`} product={item} />;
                            }
                        })}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}
