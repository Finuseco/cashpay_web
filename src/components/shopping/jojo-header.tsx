

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MessageSquare, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useBetSlip } from '@/hooks/use-bet-slip'; // Assuming this can be reused for cart count
import { Badge } from '../ui/badge';
import { getUserCart } from '@/lib/actions/shopping.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

interface JojoHeaderProps {
    showBackButton?: boolean;
    title?: string;
}

export function JojoHeader({ showBackButton = false, title = "Rechercher..." }: JojoHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState('');
  const [cartCount, setCartCount] = useState(0);

   useEffect(() => {
        const fetchCart = async () => {
            const user = await getAuthenticatedUser();
            if (user) {
                const items = await getUserCart(user.id);
                setCartCount(items.length);
            }
        };

        const handleCartUpdate = () => fetchCart();

        fetchCart();
        window.addEventListener('jojo-cart-updated', handleCartUpdate);
        return () => window.removeEventListener('jojo-cart-updated', handleCartUpdate);
    }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/shopping/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };


  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b p-2">
        <div className="flex items-center gap-2">
            {showBackButton && (
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
            )}
            <form onSubmit={handleSearch} className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder={title}
                    className="pl-10 h-10 rounded-full bg-muted border-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </form>
             <Button variant="ghost" size="icon" onClick={() => router.push('/shopping/cart')}>
                <ShoppingCart />
                 {cartCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{cartCount}</Badge>
                 )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => router.push('/feedback')}>
                <MessageSquare />
            </Button>
        </div>
    </header>
  );
}
