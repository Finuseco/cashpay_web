
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useEffect, useState } from "react";
import type { User as UserType } from "@/lib/types";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";


const NavItem = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) => {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={cn(
                "relative flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors",
                isActive ? "text-white font-bold" : "text-zinc-400 hover:text-white"
            )}
        >
            <Icon className="h-6 w-6 mb-0.5" />
            <span>{label}</span>
        </Link>
    );
};

const ProfileNavItem = ({ user, href }: { user: UserType | null, href: string }) => {
    const pathname = usePathname();
    const isActive = pathname === href;
    return (
         <Link
            href={href}
            className={cn(
                "relative flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors",
                isActive ? "text-white font-bold" : "text-zinc-400 hover:text-white"
            )}
        >
            <Avatar className="h-6 w-6 mb-0.5 rounded-sm">
                <AvatarImage src={user?.profile_photo || undefined} alt={user?.full_name} />
                <AvatarFallback>{user?.first_name?.[0]}</AvatarFallback>
            </Avatar>
            <span>Mon NetOn</span>
             {isActive && <div className="absolute bottom-0 h-0.5 w-full bg-red-600"></div>}
        </Link>
    )
}


export function CinemaFooter() {
    const { t } = useTranslation();
    const [user, setUser] = useState<UserType | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
        };
        fetchUser();
    }, []);
    
    return (
        <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-zinc-900/95 border-zinc-800 backdrop-blur-sm md:hidden">
            <nav className="grid grid-cols-4 items-center h-16">
               <NavItem href="/cinema" label="Accueil" icon={Home} />
               <NavItem href="/casino" label="Jeux" icon={Sparkles} />
               <NavItem href="/cinema/downloads" label="Téléchargements" icon={Download} />
               <ProfileNavItem user={user} href="/profile" />
            </nav>
        </footer>
    )
}
