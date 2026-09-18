'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Minus, Plus, ShoppingCart, MessageSquare, Heart, Store, AlertCircle,
  Sparkles, Star, Share2, Facebook, Twitter, MessageCircle, Send,
  Loader2, ArrowLeft, ChevronRight, Users as UsersIcon, Info,
  ShieldCheck, FileText, Music, ShieldAlert, User as UserIcon,
  ClipboardList, Eye, Trash2
} from 'lucide-react';
import type { Product, User, CartItem, Currency, Conversation, Group } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn, countryToCode } from '@/lib/utils';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  updateUserCart,
  toggleUserWishlistItem,
  getUserWishlist,
  getPublicProducts, recordProductView
} from '@/lib/actions/shopping.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getExchangeRatesForCountry } from '@/lib/actions/exchange.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import {
  getConversationsForUser,
  shareProductToChat,
  createConversationByWalletId
} from '@/lib/actions/message.actions';
import { getUserGroups } from '@/lib/actions/group.actions';
import { getCommentsForProduct, postComment, deleteComment, type Comment } from '@/lib/actions/comment.actions';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Book3D } from './book-3d';

const ShareDialog = ({ product, user }: { product: Product; user: User | null }) => {
  const { toast } = useToast();
  const { openAlert } = useAlertDialog();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    Promise.all([
      getConversationsForUser(user.id),
      getUserGroups(user.id)
    ])
      .then(([convs, grps]) => {
        setConversations(convs);
        setGroups(grps);
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  const share = async (
    targetId: string | number,
    type: 'conversation' | 'group'
  ) => {
    if (!user) return;

    setIsSharing(`${type}-${targetId}`);

    const result = await shareProductToChat({
      senderId: user.id,
      targetId,
      targetType: type,
      product
    });

    setIsSharing(null);

    if (result.success) {
      toast({
        title: 'Produit partagé',
        description: "L'article a été envoyé dans la discussion.",
        variant: 'success'
      });
    } else {
      openAlert({
        title: 'Erreur',
        description: result.error || 'Échec du partage.',
        variant: 'error'
      });
    }
  };

  const social = (platform: 'facebook' | 'twitter' | 'whatsapp') => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      `Découvrez ce produit sur JoJo Shopping : ${product.name}`
    );

    const links = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      whatsapp: `https://api.whatsapp.com/send?text=${text}%20${url}`
    };

    window.open(links[platform], '_blank', 'width=600,height=400');
  };

  return (
    <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white p-0 overflow-hidden">
      <DialogHeader className="p-6 pb-0">
        <DialogTitle>Partager ce produit</DialogTitle>
        <DialogDescription className="text-zinc-400">
          Faites découvrir cet article à vos amis.
        </DialogDescription>
      </DialogHeader>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-20 flex-col gap-1 bg-blue-600/10 border-blue-600/30 text-blue-400"
            onClick={() => social('facebook')}
          >
            <Facebook className="h-6 w-6" />
            <span className="text-[10px]">Facebook</span>
          </Button>

          <Button
            variant="outline"
            className="h-20 flex-col gap-1 bg-sky-500/10 border-sky-500/30 text-sky-400"
            onClick={() => social('twitter')}
          >
            <Twitter className="h-6 w-6" />
            <span className="text-[10px]">Twitter</span>
          </Button>

          <Button
            variant="outline"
            className="h-20 flex-col gap-1 bg-green-600/10 border-green-600/30 text-green-400"
            onClick={() => social('whatsapp')}
          >
            <MessageCircle className="h-6 w-6" />
            <span className="text-[10px]">WhatsApp</span>
          </Button>
        </div>

        <Separator className="bg-zinc-800" />

        <div className="space-y-3">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Partager sur OnChat
          </h4>

          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin h-6 w-6" />
            </div>
          ) : (
            <ScrollArea className="h-64 pr-4">
              <div className="space-y-2">
                {conversations.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer"
                    onClick={() => share(c.id, 'conversation')}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.contact.profile_photo || ''} />
                      <AvatarFallback>{c.contact.first_name?.[0]}</AvatarFallback>
                    </Avatar>

                    <span className="text-sm font-medium">
                      {c.contact.full_name}
                    </span>

                    {isSharing === `conversation-${c.id}` && (
                      <Loader2 className="ml-auto animate-spin h-3 w-3" />
                    )}
                  </div>
                ))}

                {groups.map(g => (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer"
                    onClick={() => share(g.id, 'group')}
                  >
                    <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center">
                      <UsersIcon className="h-4 w-4" />
                    </div>

                    <span className="text-sm font-medium">
                      {g.name} (Groupe)
                    </span>

                    {isSharing === `group-${g.id}` && (
                      <Loader2 className="ml-auto animate-spin h-3 w-3" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </DialogContent>
  );
};

type DescriptionBlock =
  | {
      type: 'text' | 'paragraph' | 'heading';
      content?: string;
      text?: string;
    }
  | {
      type: 'image';
      url?: string;
      src?: string;
      alt?: string;
      caption?: string;
    }
  | {
      type: 'separator';
    };

const getDescriptionBlocks = (product: Product): DescriptionBlock[] => {
  const details = product.details as any;

  const raw =
    details?.descriptionBlocks ||
    details?.descriptionContent ||
    details?.richDescription ||
    details?.description_blocks;

  if (Array.isArray(raw)) return raw;

  return product.description
    ? [{ type: 'text', content: product.description }]
    : [];
};

const getPromotionPrice = (product: Product, qty: number) => {
  const normal = Number(product.sellingPrice) || 0;

  const packages = Array.isArray(product.promotionalPackages)
    ? product.promotionalPackages
    : [];

  const valid = packages
    .map((p: any) => ({
      quantity: Number(p.quantity ?? p.minQuantity),
      price: Number(p.price)
    }))
    .filter(
      p =>
        Number.isFinite(p.quantity) &&
        p.quantity >= 1 &&
        Number.isFinite(p.price) &&
        p.price >= 0 &&
        p.price <= normal
    )
    .sort((a, b) => a.quantity - b.quantity);

  let price = normal;

  for (const p of valid) {
    if (p.quantity <= qty) {
      price = p.price;
    }
  }

  return price;
};

export function ProductDetailClient({
  product,
  user: initialUser,
  initialCart
}: {
  product: Product;
  user: User | null;
  initialCart: CartItem[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { openAlert } = useAlertDialog();

  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(initialCart);
  const [localCurrency, setLocalCurrency] = useState<Currency | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(initialUser);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const viewRecordedRef = useRef<string | null>(null);

  const isOwner = user?.id.toString() === product.seller.id;
  const isSellerInactive = product.sellerSubscriptionStatus === 'inactive';
  const isProductBlocked = !product.isPublic;
  const isBook = product.categoryId === 'cat-livre';

  const productImages = useMemo(
    () =>
      product.images?.length
        ? product.images
        : ['https://placehold.co/800x800.png'],
    [product.images]
  );

  const pricePerItem = useMemo(
    () => getPromotionPrice(product, quantity),
    [product, quantity]
  );

  const totalPrice = pricePerItem * quantity;
  useEffect(() => {
    if (viewRecordedRef.current === product.id) return;

    viewRecordedRef.current = product.id;
    setViewCount(Number((product as Product & { viewCount?: number }).viewCount || 0));

    recordProductView(product.id)
      .then(() => {
        setViewCount(prev => prev + 1);
      })
      .catch(() => {});
  }, [product.id]);

  const normalTotal = (Number(product.sellingPrice) || 0) * quantity;

  useEffect(() => {
    const load = async () => {
      const fetchedUser = initialUser || await getAuthenticatedUser();

      if (!fetchedUser) return;

      setUser(fetchedUser);

      const wishlist = await getUserWishlist(fetchedUser.id);
      setIsFavorite(wishlist.some(item => item.id === product.id));

      const currencies = await getUserCurrencies(fetchedUser.id);
      const local = currencies.find(c => c.code !== product.currency);
      setLocalCurrency(local || null);

      const countryCode = fetchedUser.country
        ? countryToCode(fetchedUser.country)
        : null;

      if (countryCode && local?.code && product.currency !== local.code) {
        const rates = await getExchangeRatesForCountry(countryCode);
        const rate = rates.find(
          r =>
            r.from_currency === product.currency &&
            r.to_currency === local.code
        );

        setExchangeRate(rate?.rate ?? null);
      }
    };

    load();
  }, [initialUser, product.id, product.currency]);

  useEffect(() => {
    setIsLoadingComments(true);

    getCommentsForProduct(product.id)
      .then(setComments)
      .finally(() => setIsLoadingComments(false));
  }, [product.id]);

  useEffect(() => {
    getPublicProducts().then((items: Product[]) => {
      setSimilarProducts(
        items
          .filter(
            item =>
              item.id !== product.id &&
              item.categoryId === product.categoryId &&
              item.isPublic
          )
          .slice(0, 8)
      );
    });
  }, [product.id, product.categoryId]);

  const requireLogin = () => {
    router.push(
      `/login?returnTo=${encodeURIComponent(window.location.pathname)}`
    );
  };

  const handleAddToCart = async () => {
    if (!user) return requireLogin();

    if (isOwner || isSellerInactive || isProductBlocked) {
      openAlert({
        title: 'Action impossible',
        description: "Ce produit n'est pas disponible à la vente.",
        variant: 'warning'
      });
      return;
    }

    if (product.stock < quantity) {
      openAlert({
        title: 'Stock insuffisant',
        description: `Il ne reste que ${product.stock} unité(s).`,
        variant: 'warning'
      });
      return;
    }

    const existing = cart.find(item => item.id === product.id);
    const newQuantity = (existing?.quantity || 0) + quantity;

    const result = await updateUserCart(
      user.id,
      product.id,
      newQuantity
    );

    if (result.success && result.cart) {
      setCart(result.cart);
      window.dispatchEvent(new Event('jojo-cart-updated'));

      toast({
        title: 'Ajouté au panier',
        description: `"${product.name}" a été ajouté au panier.`,
        variant: 'success'
      });
    } else {
      openAlert({
        title: 'Erreur',
        description: 'Impossible d’ajouter au panier.',
        variant: 'error'
      });
    }
  };

  const handleBuyNow = async () => {
    if (!user) return requireLogin();

    if (isOwner || isSellerInactive || isProductBlocked) return;

    if (product.stock < quantity) {
      openAlert({
        title: 'Stock insuffisant',
        description: `Il ne reste que ${product.stock} unité(s).`,
        variant: 'warning'
      });
      return;
    }

    const result = await updateUserCart(
      user.id,
      product.id,
      quantity
    );

    if (result.success) {
      window.dispatchEvent(new Event('jojo-cart-updated'));
      router.push('/shopping/cart');
    } else {
      openAlert({
        title: 'Erreur',
        description: "Impossible d'initier l'achat.",
        variant: 'error'
      });
    }
  };

  const handleFavoriteToggle = async () => {
    if (!user) return requireLogin();

    setIsTogglingFavorite(true);

    const result = await toggleUserWishlistItem(
      user.id,
      product.id
    );

    setIsTogglingFavorite(false);

    if (result.success) {
      setIsFavorite(result.isFavorite);

      toast({
        title: result.isFavorite
          ? 'Ajouté aux favoris'
          : 'Retiré des favoris',
        description: result.isFavorite
          ? 'Produit ajouté à votre liste.'
          : 'Produit retiré de votre liste.',
        variant: 'success'
      });
    } else {
      openAlert({
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue.',
        variant: 'error'
      });
    }
  };

  const handleDeleteComment = async (commentId: number) => {
  if (!user) return requireLogin();

  const result = await deleteComment(commentId);

  if (!result.success) {
    openAlert({
      title: 'Erreur',
      description: result.error || 'Impossible de supprimer le commentaire.',
      variant: 'error'
    });
    return;
  }

  setComments(prev =>
    prev.filter(comment => comment.id !== commentId)
  );
};

const handlePostComment = async () => {
    if (!user) return requireLogin();
    if (!newComment.trim()) return;

    setIsPostingComment(true);

    const result = await postComment({
      productId: product.id,
      user,
      text: newComment
    });

    setIsPostingComment(false);

    if (result.success && result.comment) {
      setComments(prev => [result.comment!, ...prev]);
      setNewComment('');
    } else {
      openAlert({
        title: 'Erreur',
        description: result.error || 'Impossible de publier.',
        variant: 'error'
      });
    }
  };

  const changeQuantity = (amount: number) => {
    setQuantity(prev =>
      Math.max(1, Math.min(product.stock, prev + amount))
    );
  };

  useEffect(() => {
    if (productImages.length <= 1) return;
    const timer = setInterval(() => {
      setSelectedImageIndex(i => (i + 1) % productImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [productImages.length]);

  const nextImage = () => {
    setSelectedImageIndex(
      i => (i + 1) % productImages.length
    );
  };

  const previousImage = () => {
    setSelectedImageIndex(
      i => (i - 1 + productImages.length) % productImages.length
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const dx =
      e.changedTouches[0].clientX - touchStart.current.x;

    const dy =
      e.changedTouches[0].clientY - touchStart.current.y;

    touchStart.current = null;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) nextImage();
      else previousImage();
    }
  };

  const renderDescription = () => {
    const blocks = getDescriptionBlocks(product);

    if (!blocks.length) {
      return (
        <p className="text-sm text-zinc-700">
          Aucune description disponible pour cet article.
        </p>
      );
    }

    return (
      <div className="space-y-5">
        {blocks.map((block, index) => {
          if (block.type === 'separator') {
            return <Separator key={index} />;
          }

          if (block.type === 'image') {
            const src = block.url || block.src;

            if (!src) return null;

            return (
              <figure key={index} className="space-y-2">
                <div className="relative w-full overflow-hidden rounded-xl bg-muted min-h-[180px]">
                  <Image
                    src={src}
                    alt={block.alt || product.name}
                    width={1200}
                    height={800}
                    className="w-full h-auto object-contain"
                  />
                </div>

                {block.caption && (
                  <figcaption className="text-xs text-muted-foreground text-center">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );
          }

          const text =
            block.content ||
            block.text ||
            '';

          if (block.type === 'heading') {
            return (
              <h3
                key={index}
                className="text-lg font-bold"
              >
                {text}
              </h3>
            );
          }

          return (
            <p
              key={index}
              className="text-sm leading-7 text-zinc-700 whitespace-pre-wrap"
            >
              {text}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <main className="flex-1 pb-28">
      <div
        className="relative w-full aspect-square bg-muted overflow-hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={() => setZoom(v => !v)}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 z-20 bg-black/40 text-white rounded-full"
          onClick={() => router.back()}
        >
          <ArrowLeft />
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-20 bg-black/40 text-white rounded-full"
            >
              <Share2 />
            </Button>
          </DialogTrigger>

          <ShareDialog
            product={product}
            user={user}
          />
        </Dialog>

        {isProductBlocked ? (
          <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center text-center p-8 gap-4 text-white">
            <ShieldAlert className="h-20 w-20 text-red-500 opacity-50" />
            <p className="font-bold text-lg">
              Produit suspendu
            </p>
            <p className="text-zinc-400 text-sm">
              Ce contenu a été masqué par les administrateurs.
            </p>
          </div>
        ) : isBook ? (
          <Book3D
            frontCover={productImages[0]}
            backCover={productImages[1]}
            className="w-full h-full"
            editionType={product.details?.editionType}
            title={product.name}
            author={product.details?.author}
            isbn={product.details?.isbn13}
          />
        ) : (
          <Image
            src={productImages[selectedImageIndex]}
            alt={product.name}
            fill
            priority
            className={cn(
              'object-cover transition-transform duration-300',
              zoom && 'scale-150'
            )}
          />
        )}

        {!isBook && productImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {productImages.map((_, index) => (
              <button
                key={index}
                aria-label={`Image ${index + 1}`}
                onClick={() => setSelectedImageIndex(index)}
                className={cn(
                  'h-2 w-2 rounded-full bg-white/50',
                  selectedImageIndex === index &&
                    'w-6 bg-white'
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 space-y-7">
        {isSellerInactive && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Ventes suspendues</AlertTitle>
            <AlertDescription>
              La boutique de ce vendeur est temporairement hors ligne.
            </AlertDescription>
          </Alert>
        )}

        <section className="space-y-2">
          <h1 className="text-xl font-bold">
            {product.name}
          </h1>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-[1.95rem] font-black text-primary">
                  {product.currency} {totalPrice.toFixed(2)}
                </p>

                {pricePerItem < Number(product.sellingPrice) && (
                  <p className="text-sm text-muted-foreground line-through">
                    {product.currency} {normalTotal.toFixed(2)}
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {product.currency} {pricePerItem.toFixed(2)} / unité
              </p>

              {localCurrency && exchangeRate ? (
                <div className="mt-2 rounded-lg bg-primary/5 border border-primary/10 p-2">
                  <p className="text-xs font-semibold text-primary">
                    1 {product.currency} ={' '}
                    {exchangeRate.toLocaleString('fr-FR')}{' '}
                    {localCurrency.code}
                  </p>

                  <p className="text-sm font-bold">
                    Total ≈{' '}
                    {(totalPrice * exchangeRate).toLocaleString(
                      'fr-FR',
                      {
                        style: 'currency',
                        currency: localCurrency.code,
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2
                      }
                    )}
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    Taux de change du jour
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="h-4 w-4 fill-yellow-500" />
              <span className="text-sm font-bold">
                4.8
              </span>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              product.stock > 0
                ? 'secondary'
                : 'destructive'
            }
          >
            {product.stock > 0
              ? `${product.stock} en stock`
              : 'Épuisé'}
          </Badge>

          {product.isPublic && (
            <Badge
              variant="outline"
              className="border-primary text-primary"
            >
              Market Public
            </Badge>
          )}

          {product.details?.editionType === 'cashpay' && (
            <Badge className="bg-[#000E38] text-white">
              <ShieldCheck className="h-3 w-3 mr-1 text-orange-500" />
              Édition CashPay
            </Badge>
          )}
        </div>

        {isOwner && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              C'est votre produit
            </AlertTitle>
            <AlertDescription>
              Vous ne pouvez pas acheter un produit que vous
              vendez vous-même.
            </AlertDescription>
          </Alert>
        )}

        {product.promotionalPackages?.length ? (
          <section className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2 text-orange-700">
              <Sparkles className="h-4 w-4" />
              Offres de gros
            </h3>

            <div className="space-y-2">
              {product.promotionalPackages
                .map((pkg: any) => ({
                  quantity: Number(
                    pkg.quantity ?? pkg.minQuantity
                  ),
                  price: Number(pkg.price)
                }))
                .filter(
                  pkg =>
                    Number.isFinite(pkg.quantity) &&
                    Number.isFinite(pkg.price)
                )
                .sort(
                  (a, b) => a.quantity - b.quantity
                )
                .map((pkg, index) => (
                  <div
                    key={index}
                    className="flex justify-between text-sm text-orange-800"
                  >
                    <span>
                      {pkg.quantity}+ unités
                    </span>

                    <strong>
                      {product.currency}{' '}
                      {pkg.price.toFixed(2)} / unité
                    </strong>
                  </div>
                ))}
            </div>
          </section>
        ) : null}

          {/* Statistiques du produit — données réelles */}
          <section className="rounded-xl border border-[#FF6600]/30 bg-[#000E38] p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <Eye className="h-5 w-5 shrink-0 text-[#FF6600]" />
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none text-white">{viewCount}</p>
                  <p className="mt-1 truncate text-xs text-[#FF6600]">Vues</p>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <ShoppingCart className="h-5 w-5 shrink-0 text-[#FF6600]" />
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none text-white">{Number((product as Product & { orderCount?: number }).orderCount || 0)}</p>
                  <p className="mt-1 truncate text-xs text-[#FF6600]">Commandes</p>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <MessageSquare className="h-5 w-5 shrink-0 text-[#FF6600]" />
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none text-white">{Number((product as Product & { commentCount?: number }).commentCount || 0)}</p>
                  <p className="mt-1 truncate text-xs text-[#FF6600]">Commentaires</p>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <Star className="h-5 w-5 shrink-0 fill-[#FF6600] text-[#FF6600]" />
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none text-white">{Number((product as Product & { reviewCount?: number }).reviewCount || 0)}</p>
                  <p className="mt-1 truncate text-xs text-[#FF6600]">Avis</p>
                </div>
              </div>
            </div>
          </section>

        <section className="space-y-4">
          <h2 className="font-bold text-lg">
            Informations du produit
          </h2>

          {renderDescription()}
        </section>

        {product.details?.conclusion && (
          <section className="rounded-xl border-l-4 border-primary bg-zinc-50 p-4">
            <h3 className="font-bold text-xs uppercase tracking-widest text-primary flex items-center gap-2">
              <Info className="h-3 w-3" />
              Mot de l'auteur
            </h3>

            <p className="text-sm italic text-zinc-600 mt-2">
              "{product.details.conclusion}"
            </p>
          </section>
        )}

        {isBook && product.details && (
          <section className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm p-4 bg-muted/30 rounded-xl">
              <div>
                <p className="text-zinc-500">Langue</p>
                <p className="font-bold">
                  {product.details.language}
                </p>
              </div>

              <div>
                <p className="text-zinc-500">Pages</p>
                <p className="font-bold">
                  {product.details.pageCount}
                </p>
              </div>

              <div>
                <p className="text-zinc-500">Éditeur</p>
                <p className="font-bold">
                  {product.details.publisher}
                </p>
              </div>

              <div>
                <p className="text-zinc-500">ISBN-13</p>
                <p className="font-mono text-xs">
                  {product.details.isbn13 || 'N/A'}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border-2 border-primary">
                  <AvatarImage
                    src={
                      product.details.authorImage || ''
                    }
                  />
                  <AvatarFallback>
                    <UserIcon />
                  </AvatarFallback>
                </Avatar>

                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">
                    À propos de l'auteur
                  </p>

                  <p className="font-bold text-lg">
                    {product.details.author}
                  </p>
                </div>
              </div>

              <p className="text-sm text-white leading-relaxed">
                {product.details.authorBio}
              </p>
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">
              Commentaires
            </h2>

            <Badge variant="secondary">
              {comments.length}
            </Badge>
          </div>

          {user ? (
            <div className="space-y-3">
              <Textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Écrire un commentaire..."
                className="min-h-[90px]"
              />

              <Button
                onClick={handlePostComment}
                disabled={
                  isPostingComment ||
                  !newComment.trim()
                }
              >
                {isPostingComment ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Publier
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={requireLogin}
              className="w-full"
            >
              Connectez-vous pour commenter
            </Button>
          )}

          {isLoadingComments ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : comments.length ? (
            <div className="space-y-4">
              {comments.map(comment => (
                <div
                  key={comment.id}
                  className="flex gap-3 rounded-xl border p-4"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage
                      src={
                        comment.user?.profile_photo ||
                        ''
                      }
                    />
                    <AvatarFallback>
                      {comment.user?.first_name?.[0] ||
                        'U'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-sm">
                        {comment.user?.full_name || ''}
                      </p>

                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {comment.created_at
                          ? formatDistanceToNow(
                              new Date(comment.created_at),
                              {
                                addSuffix: true,
                                locale: fr
                              }
                            )
                          : ''}
                      </span>
                        {user && comment.user_id === user.id && (<Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteComment(comment.id)}><Trash2 className="mr-1 h-3.5 w-3.5" />Supprimer</Button>)}
                    </div>

                    <p className="text-sm text-white whitespace-pre-wrap mt-1">
                      {comment.content ||
                        comment.text ||
                        ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aucun commentaire pour le moment.
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-xl bg-zinc-900 p-4 text-white">
          <h2 className="font-bold text-lg text-white">
            Boutique
          </h2>

          <Link
            href={`/shopping/seller/${product.seller.id}?boutiqueId=${product.boutiqueId}`}
            className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/50 transition-colors"
          >
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={product.seller.profile_photo || ''}
              />
              <AvatarFallback>
                <Store className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                    {product.boutiqueName || 'Magasin Certifié'}
                  </p>

                  <Image
                    src="/images/badge/shopping-verified.png"
                    alt="Vendeur Vérifié"
                    width={80}
                    height={20}
                    className="h-4 w-auto shrink-0"
                  />
                </div>

                <p className="mt-0.5 truncate text-xs text-zinc-300">
                  Voir la boutique et ses produits
                </p>
              </div>
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </section>

        {similarProducts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">
                Produits similaires
              </h2>

              <Link
                href={`/shopping?category=${encodeURIComponent(
                  product.categoryId || ''
                )}`}
                className="text-xs font-semibold text-primary"
              >
                Voir tout
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {similarProducts.map(item => (
                <Link
                  key={item.id}
                  href={`/shopping/${item.id}`}
                  className="overflow-hidden rounded-xl border bg-background hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-square bg-muted">
                    <Image
                      src={
                        item.images?.[0] ||
                        'https://placehold.co/600x600.png'
                      }
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="p-3 space-y-1">
                    <p className="font-semibold text-sm line-clamp-2">
                      {item.name}
                    </p>

                    <p className="font-black text-primary">
                      {item.currency}{' '}
                      {(Number(item.sellingPrice) || 0).toFixed(2)}
                    </p>

                    {item.boutique && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.boutique}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-14 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md px-2 py-2">
        <div className="mx-auto max-w-3xl grid grid-cols-5 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-12 flex-col gap-0.5 text-[10px]"
            onClick={handleFavoriteToggle}
            disabled={isTogglingFavorite}
          >
            {isTogglingFavorite ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart
                className={cn(
                  'h-4 w-4',
                  isFavorite &&
                    'fill-red-500 text-red-500'
                )}
              />
            )}
            <span>Favoris</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-12 flex-col gap-0.5 text-[10px]"
            onClick={async () => {
              if (!user) return requireLogin();

              if (!product.sellerWalletId) {
                openAlert({
                  title: 'Chat indisponible',
                  description: 'Le portefeuille du vendeur est introuvable.',
                  variant: 'error'
                });
                return;
              }

              const result = await createConversationByWalletId(
                user.id,
                product.sellerWalletId
              );

              if (result.success && result.conversation?.contact) {
                router.push(
                  `/feedback?contactId=${result.conversation.contact.id}`
                );
              } else {
                openAlert({
                  title: 'Impossible de démarrer le chat',
                  description:
                    result.error || 'Impossible de démarrer la conversation avec le vendeur.',
                  variant: 'error'
                });
              }
            }}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Chat</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-12 flex-col gap-0.5 text-[10px]"
            onClick={() =>
              router.push(
                `/shopping/seller/${product.seller.id}?boutiqueId=${product.boutiqueId}`
              )
            }
          >
            <Store className="h-4 w-4" />
            <span>Magasin</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-12 flex-col gap-0.5 text-[10px]"
            onClick={handleAddToCart}
            disabled={
              product.stock < 1 ||
              isOwner ||
              isSellerInactive ||
              isProductBlocked
            }
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Panier</span>
          </Button>

          <Button
            size="sm"
            className="flex-1 h-12 flex-col gap-0.5 text-[10px]"
            onClick={handleBuyNow}
            disabled={
              product.stock < 1 ||
              isOwner ||
              isSellerInactive ||
              isProductBlocked
            }
          >
            <ClipboardList className="h-4 w-4" />
            <span>Commande</span>
          </Button>
        </div>

        <div className="mx-auto max-w-3xl flex items-center justify-center gap-2 pt-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => changeQuantity(-1)}
            disabled={
              quantity <= 1 ||
              isOwner ||
              isSellerInactive ||
              isProductBlocked
            }
          >
            <Minus className="h-3 w-3" />
          </Button>

          <Input
            value={quantity}
            onChange={e => {
              const value = Math.max(
                1,
                Math.min(
                  product.stock,
                  Math.trunc(Number(e.target.value)) || 1
                )
              );

              setQuantity(value);
            }}
            className="h-8 w-14 text-center font-bold"
            inputMode="numeric"
          />

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => changeQuantity(1)}
            disabled={
              quantity >= product.stock ||
              isOwner ||
              isSellerInactive ||
              isProductBlocked
            }
          >
            <Plus className="h-3 w-3" />
          </Button>

          <span className="text-xs text-muted-foreground ml-1">
            {quantity} × {product.currency}{' '}
            {pricePerItem.toFixed(2)}
          </span>
        </div>
      </div>
    </main>
  );
}
