
'use client';

import type { Product, User } from '@/lib/types';
import { ProductCard } from './product-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Heart, Rss, ArrowLeft, ArrowRight, Store, Loader2, MessageCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getStoreFollowerInfo, toggleFollowStore, getPublicProducts } from '@/lib/actions/shopping.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createConversationByWalletId } from '@/lib/actions/message.actions';
import { cn } from '@/lib/utils';
import { formatKiloMega } from '@/lib/utils';
import { joinNetwork } from '@/lib/actions/mlm.actions';
import Image from 'next/image';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';


export function SellerProductsClient({
    products,
    seller,
    boutique,
}: {
    products: Product[];
    seller: User;
    boutique: {
        id: string;
        name: string;
        whatsapp_public_number: string | null;
    } | null;
}) {
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

    const handleChat = async () => {
        if (!currentUser) {
            openAlert({
                title: 'Connexion requise',
                description: 'Veuillez vous connecter pour contacter cette boutique.',
                variant: 'info',
            });
            return;
        }

        const sellerWalletId = products.find(
            product => product.sellerWalletId
        )?.sellerWalletId;

        if (!sellerWalletId) {
            openAlert({
                title: 'Chat indisponible',
                description: 'Le portefeuille du vendeur est introuvable.',
                variant: 'error',
            });
            return;
        }

        const result = await createConversationByWalletId(
            currentUser.id,
            sellerWalletId
        );

        if (result.success && result.conversation?.contact) {
            window.location.href =
                `/feedback?contactId=${result.conversation.contact.id}`;
            return;
        }

        openAlert({
            title: 'Impossible de démarrer le chat',
            description:
                result.error ||
                'Impossible de démarrer la conversation avec le vendeur.',
            variant: 'error',
        });
    };

    const handleWhatsApp = () => {
        if (!boutique?.whatsapp_public_number) {
            return;
        }

        const number = boutique.whatsapp_public_number.replace(/\D/g, '');

        if (number.length < 8) {
            return;
        }

        const message = `Bonjour, cher partenaire ${boutique.name}.

Je vous contacte depuis Jojo Shopping. Je souhaiterais avoir des informations concernant vos produits, vos ventes ou éventuellement une commande.

Merci de bien vouloir m'assister.`;

        window.open(
            `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
            '_blank',
            'noopener,noreferrer'
        );
    };

    const boutiqueName = products[0]?.boutiqueName || 'Boutique Certifiée';
    const sellerHandle = `@${seller.full_name.toLowerCase().replace(/\s/g, '')}`;

    const formatFollowers = (value: number) => {
        if (value >= 1_000_000) {
            return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
        }
        if (value >= 1_000) {
            return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
        }
        return String(value);
    };

    return (
        <div className="max-w-5xl mx-auto pb-8">
            <div className="relative">
                <div className="relative h-44 sm:h-56 overflow-hidden rounded-b-2xl bg-gradient-to-r from-primary/30 via-primary/10 to-background">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                </div>

                <div className="relative px-4">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14">
                        <Avatar className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-4 border-[#FF6600] bg-background shadow-xl shrink-0">
                            <AvatarImage
                                src={seller.profile_photo || undefined}
                                alt={boutiqueName}
                            />
                            <AvatarFallback className="rounded-2xl bg-primary/10">
                                <Store className="h-10 w-10 text-primary" />
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 sm:pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                                    {boutiqueName}
                                </h1>
                                <Image
                                    src="/images/badge/shopping-verified.png"
                                    alt="Vendeur Vérifié"
                                    width={80}
                                    height={22}
                                    className="h-3.5 w-auto shrink-0"
                                />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                                {seller.full_name} {sellerHandle}
                            </p>
                        </div>

                        <Button
                            onClick={handleFollowToggle}
                            variant={isFollowing ? "secondary" : "default"}
                            disabled={isTogglingFollow}
                            className={cn(
                                "sm:mb-2 rounded-full px-5 font-semibold shadow-sm",
                                !isFollowing && "bg-[#FF6600] hover:bg-[#E65C00] text-white"
                            )}
                        >
                            {isTogglingFollow ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Rss className="h-4 w-4 mr-2" />
                            )}
                            {isFollowing ? "Abonné" : "S'abonner"}
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleChat}
                            className="rounded-full px-4 font-semibold"
                        >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Chat
                        </Button>

                        {boutique?.whatsapp_public_number && (
                            <Button
                                type="button"
                                onClick={handleWhatsApp}
                                className="rounded-full px-4 font-semibold bg-[#25D366] hover:bg-[#1ebe5d] text-white"
                            >
                                <MessageCircle className="h-4 w-4 mr-2" />
                                WhatsApp
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-4 border-y mt-5 py-4">
                        <div className="text-center border-r">
                            <p className="font-bold text-foreground">
                                {formatFollowers(followerCount)}
                            </p>
                            <p className="text-xs text-muted-foreground">Abonnés</p>
                        </div>
                        <div className="text-center border-r">
                            <p className="font-bold text-foreground">{products.length}</p>
                            <p className="text-xs text-muted-foreground">Articles</p>
                        </div>
                        <div className="text-center border-r">
                            <p className="font-bold text-foreground">0</p>
                            <p className="text-xs text-muted-foreground">Avis</p>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-foreground">0</p>
                            <p className="text-xs text-muted-foreground">Commandes</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 mt-6 space-y-6">
                <Card className="bg-primary/5 border-primary/10">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">
                            Programme Affilié : {boutiqueName}
                        </CardTitle>
                        <CardDescription>
                            Devenez un partenaire de cette boutique pour gagner des commissions sur les ventes du réseau.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-3">
                        <Button
                            className="flex-1"
                            variant="outline"
                            onClick={() => handleJoinNetwork('left')}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Rejoindre à Gauche
                        </Button>
                        <Button
                            className="flex-1"
                            variant="outline"
                            onClick={() => handleJoinNetwork('right')}
                        >
                            Rejoindre à Droite
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg sm:text-xl font-bold">
                            Articles de la boutique
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            {products.length} article{products.length > 1 ? 's' : ''}
                        </span>
                    </div>

                    {products.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {products.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
                            <Store className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p>Cette boutique n'a aucun produit public pour le moment.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )

}

