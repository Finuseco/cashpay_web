
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { mainNavLinks, adminNavLinks } from '@/lib/nav-links';

interface NavLinksProps {
  isMobile?: boolean;
  isAdmin?: boolean;
}

export default function NavLinks({ isAdmin = false }: NavLinksProps) {
  const pathname = usePathname();
  const links = isAdmin ? adminNavLinks : mainNavLinks;

  return (
    <>
      {links.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.name}
            href={link.href}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-primary text-sidebar-primary-foreground"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.name}
          </Link>
        );
      })}
    </>
  );
}
