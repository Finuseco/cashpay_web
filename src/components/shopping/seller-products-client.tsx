
'use client';

import type { Product, User } from '@/lib/types';
import { ProductCard } from './product-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Heart, Rss, ArrowLeft, ArrowRight, Store, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getStoreFollowerInfo, toggleFollowStore, getPublicProducts } from '@/lib/actions/shopping.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { cn } from '@/lib/utils';
import { formatKiloMega } from '@/lib/utils';
import { joinNetwork } from '@/lib/actions/mlm.actions';
import Image from 'next/image';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';


export function SellerProductsClient({ products, seller }: { products: Product[], seller: User }) {
    const { openAlert } = useAlertDialog();
    const [isFollowing, setIsFollowing] = useState(false);
    const [isTogglingFollow, setIsTogglingFollow] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const fetchFollowerInfo = useCallback(async () => {
        const user = await getAuthenticatedUser();
        setCurrentUser(user);
        const info = await getStoreFollowerInfo(user?.id, Number(seller.id));
        setIsFollowing(info.isFollowing);
        setFollowerCount(info.followerCount);
    }, [seller.id]);

    useEffect(() => {
        fetchFollowerInfo();
    }, [fetchFollowerInfo]);

    const handleFollowToggle = async () => {
        if (!currentUser) {
            openAlert({ title: "Connexion requise", description: "Veuillez vous connecter pour suivre cette boutique.", variant: 'info' });
            return;
        }
        
        setIsTogglingFollow(true);
        const result = await toggleFollowStore(currentUser.id, Number(seller.id));
        setIsTogglingFollow(false);

        if (result.success) {
            setIsFollowing(result.isFollowing!);
            setFollowerCount(prev => result.isFollowing ? prev + 1 : prev - 1);
        }
    };
    
    const handleJoinNetwork = async (position: 'left' | 'right') => {
        if (!currentUser || !seller.id) return;
        const result = await joinNetwork(currentUser.id, parseInt(seller.id.toString()), position);
        if (result.success) {
            openAlert({ title: 'Réseau Rejoint', description: `Vous avez rejoint le réseau de ${seller.full_name}.`, variant: 'success' });
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    const boutiqueName = products[0]?.boutiqueName || 'Boutique Certifiée';
    const sellerHandle = `@${seller.full_name.toLowerCase().replace(/\s/g, '')}`;

    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 border-b pb-6">
                <div className="h-20 w-20 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Store className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold text-foreground">{boutiqueName}</h1>
                        <Image src="/images/badge/shopping-verified.png" alt="Vendeur Vérifié" width={100} height={28} className="h-5 w-auto"/>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Propriétaire : {seller.full_name} ({sellerHandle})</p>
                    <p className="text-xs font-bold text-primary mt-2">{formatKiloMega(followerCount)} ABONNÉS</p>
                </div>
                 <Button onClick={handleFollowToggle} variant={isFollowing ? "secondary" : "default"} disabled={isTogglingFollow} className={cn("font-bold shadow-md", !isFollowing && "bg-red-600 hover:bg-red-700 text-white")}>
                    {isTogglingFollow ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Rss className="mr-2 h-4 w-4" />}
                    {isFollowing ? "Abonné" : "S'abonner"}
                </Button>
            </div>

            <Card className="bg-primary/5 border-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg">Programme Affilié : {boutiqueName}</CardTitle>
                    <CardDescription>Devenez un partenaire de cette boutique pour gagner des commissions sur les ventes du réseau.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Button className="flex-1" variant="outline" onClick={() => handleJoinNetwork('left')}>
                        <ArrowLeft className="mr-2 h-4 w-4"/>
                        Rejoindre à Gauche
                    </Button>
                     <Button className="flex-1" variant="outline" onClick={() => handleJoinNetwork('right')}>
                        Rejoindre à Droite
                        <ArrowRight className="ml-2 h-4 w-4"/>
                    </Button>
                </CardContent>
            </Card>

             <div className="space-y-4">
                <h2 className="text-xl font-bold">Articles de la boutique</h2>
                {products.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
                        <p>Cette boutique n'a aucun produit public pour le moment.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

