'use client';

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Users, Video, Bell, Menu, Search, ArrowLeft } from "lucide-react";
import { MonPaysLogo } from "./monpays-logo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Input } from "../ui/input";

const NavItem = ({ href, icon: Icon, hasNotification = false }: { href: string; icon: React.ElementType, hasNotification?: boolean }) => {
    const pathname = usePathname();
    const isActive = pathname === href;
    return (
        <Link href={href} className="relative w-full flex justify-center py-3 border-b-4 transition-colors border-transparent data-[active=true]:border-red-600" data-active={isActive}>
            <Icon className={cn("h-7 w-7", isActive ? "text-red-500" : "text-zinc-400")} />
            {hasNotification && (
                <div className="absolute top-1 right-4 md:right-8">
                     <span className="relative flex h-5 w-5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-red-500 text-xs font-bold">15+</span>
                    </span>
                </div>
            )}
        </Link>
    );
};

export function MonPaysHeader() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);
  
  useEffect(() => {
    // Sync search bar with URL on navigation
    setSearchTerm(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    const params = new URLSearchParams(searchParams.toString());
    if (newSearchTerm) {
        params.set('q', newSearchTerm);
    } else {
        params.delete('q');
    }
    // Use replace to avoid polluting browser history
    router.replace(`${pathname}?${params.toString()}`);
  };

  const navItems = [
    { href: "/monpays/dashboard", icon: Home },
    { href: "#", icon: Users },
    { href: "/monpays/videos", icon: Video, hasNotification: true },
    { href: "#", icon: Bell },
    { href: "/monpays/menu", icon: Menu },
  ];

  return (
    <header className="bg-zinc-800 text-zinc-100 shadow-md sticky top-0 z-20">
        {/* Top bar */}
        <div className="flex items-center justify-between p-2 h-14">
            {!isSearchOpen ? (
                <>
                    <MonPaysLogo className="text-red-500" />
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="rounded-full bg-zinc-700 hover:bg-zinc-600" onClick={() => setIsSearchOpen(true)}>
                            <Search />
                        </Button>
                    </div>
                </>
            ) : (
                <div className="flex items-center gap-2 w-full">
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setIsSearchOpen(false); router.replace(pathname); }}>
                        <ArrowLeft />
                    </Button>
                    <Input 
                        ref={searchInputRef}
                        placeholder="Rechercher sur MonPays..."
                        className="bg-zinc-700 border-none h-10"
                        value={searchTerm}
                        onChange={handleSearchChange}
                    />
                </div>
            )}
        </div>
        {/* Navigation Tabs */}
        <div className="grid grid-cols-5">
            {navItems.map((item, index) => (
                <NavItem key={index} {...item} />
            ))}
        </div>
    </header>
  );
}
