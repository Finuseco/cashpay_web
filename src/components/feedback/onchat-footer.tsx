'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Phone, Users, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

const NavItem = ({ href, icon: Icon, label, onClick, isActive }: { href: string; icon: React.ElementType; label: string; onClick?: () => void; isActive: boolean }) => {

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (onClick) {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <Link
            href={href}
            onClick={handleClick}
            className={cn(
                "flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors",
                isActive ? "text-white font-bold" : "text-zinc-400 hover:text-white"
            )}
        >
            <Icon className="h-6 w-6 mb-0.5" />
            <span>{label}</span>
        </Link>
    );
};

export function OnChatFooter({ activeView, onNavigate }: { activeView: string, onNavigate: (view: 'list' | 'calls' | 'groups' | 'news') => void }) {
    const { t } = useTranslation();
    
    return (
        <footer className="absolute bottom-0 left-0 right-0 z-10 border-t bg-[#1f2c33] border-zinc-700/50">
            <nav className="grid grid-cols-4 items-center h-16">
               <NavItem href="#" onClick={() => onNavigate('list')} label="Discussions" icon={MessageSquare} isActive={activeView === 'list'}/>
               <NavItem href="#" onClick={() => onNavigate('calls')} label="Appels" icon={Phone} isActive={activeView === 'calls'} />
               <NavItem href="#" onClick={() => onNavigate('groups')} label="Groupes" icon={Users} isActive={activeView === 'groups'} />
               <NavItem href="#" onClick={() => onNavigate('news')} label="Actualités" icon={Newspaper} isActive={activeView === 'news'} />
            </nav>
        </footer>
    )
}
