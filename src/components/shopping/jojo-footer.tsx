

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Layers, ShoppingBag, ShoppingCart, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useCallback } from 'react';
import type { CartItem } from '@/lib/types';
import { getUserCart } from '@/lib/actions/shopping.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';


const NavItem = ({ href, icon: Icon, label, badgeCount }: { href: string; icon: React.ElementType; label: string, badgeCount?: number }) => {
    const pathname = usePathname();
    const isActive = pathname.startsWith(href) && (href !== '/shopping/home' || pathname === '/shopping/home');

    return (
        <Link
            href={href}
            className={cn(
                "relative flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
            )}
        >
            <Icon className="h-6 w-6 mb-0.5" />
            <span>{label}</span>
            {badgeCount && badgeCount > 0 && (
                <Badge className="absolute -top-1 right-1/2 translate-x-[120%] bg-red-500 text-white px-1.5 py-0 h-4">{badgeCount}</Badge>
            )}
        </Link>
    );
};


export function JojoFooter() {
    const [cartCount, setCartCount] = useState(0);

    const fetchCartCount = useCallback(async () => {
        const user = await getAuthenticatedUser();
        if (user) {
            const items = await getUserCart(user.id);
            setCartCount(items.length);
        }
    }, []);

    useEffect(() => {
        const updateCartCount = () => {
            fetchCartCount();
        };

        updateCartCount(); // Initial check

        window.addEventListener('jojo-cart-updated', updateCartCount);

        return () => {
            window.removeEventListener('jojo-cart-updated', updateCartCount);
        };
    }, [fetchCartCount]);
    
    const footerNavItems = [
        { href: "/shopping/home", label: "Accueil", icon: Home },
        { href: "/shopping/categories", label: "Catégories", icon: Layers },
        { href: "/shopping/followed-stores", label: "Boutiques", icon: ShoppingBag },
        { href: "/shopping/cart", label: "Panier", icon: ShoppingCart, badgeCount: cartCount },
        { href: "/shopping/account", label: "Mon JoJo", icon: User },
    ];
    
    return (
        <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm">
            <nav className="grid grid-cols-5 items-center h-16">
               {footerNavItems.map((item, index) => (
                    <NavItem key={index} href={item.href} icon={item.icon} label={item.label} badgeCount={item.badgeCount} />
               ))}
            </nav>
        </footer>
    )
}
