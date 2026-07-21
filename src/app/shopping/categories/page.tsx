
'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProductCard } from '@/components/shopping/product-card';
import type { Product, ProductCategory } from '@/lib/types';
import { getPublicProducts } from '@/lib/actions/shopping.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Consistent category list including "Livre"
const mainCategories: ProductCategory[] = [
    { id: 'cat-hab', name: 'Habillement', domain: 'Habillement' },
    { id: 'cat-elec', name: 'Électronique', domain: 'Électronique' },
    { id: 'cat-alim', name: 'Alimentaire', domain: 'Alimentation' },
    { id: 'cat-cosm', name: 'Cosmétiques', domain: 'Beauté' },
    { id: 'cat-quin', name: 'Quincaillerie', domain: 'Quincaillerie' },
    { id: 'cat-livre', name: 'Livre', domain: 'Livre' },
    { id: 'cat-auto', name: 'Auto Mobil', domain: 'Auto Mobil' },
    { id: 'cat-autre', name: 'Autre', domain: 'Autre' },
];

function CategoriesLoadingSkeleton() {
    return (
        <div className="flex h-full bg-background">
            <aside className="w-1/4 bg-muted/50 border-r p-2 space-y-1">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </aside>
            <main className="flex-1 p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="aspect-square w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-6 w-1/2" />
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

export default function CategoriesPage() {
    const [activeCategory, setActiveCategory] = useState<string>(mainCategories[0].id);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoading(true);
            const fetchedProducts = await getPublicProducts();
            setProducts(fetchedProducts);
            setIsLoading(false);
        };
        fetchProducts();
    }, []);

    const filteredProducts = useMemo(() => {
        // Corrected filtering logic to match categoryId directly.
        return products.filter(p => p.categoryId === activeCategory);
    }, [products, activeCategory]);

    if (isLoading) {
        return <CategoriesLoadingSkeleton />;
    }

    return (
        <div className="flex h-full bg-background">
            <aside className="w-1/4 bg-muted/50 border-r overflow-y-auto no-scrollbar">
                {mainCategories.map(category => (
                    <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={cn(
                            "w-full text-left p-3 text-sm font-medium transition-colors",
                            activeCategory === category.id ? "bg-background text-primary border-l-4 border-primary" : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        {category.name}
                    </button>
                ))}
            </aside>
            <main className="flex-1 overflow-y-auto">
                 <ScrollArea className="h-full">
                    <div className="p-4">
                        {filteredProducts.length > 0 ? (
                             <div className="grid grid-cols-2 gap-2">
                                {filteredProducts.map(product => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-muted-foreground">
                                <p>Aucun produit dans cette catégorie.</p>
                            </div>
                        )}
                    </div>
                 </ScrollArea>
            </main>
        </div>
    );
}
