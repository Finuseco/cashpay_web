
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { X } from 'lucide-react';
import NavLinks from './nav-links';
import { Logo } from '@/components/logo';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {

  const content = (
    <div className="flex h-full flex-col">
       <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <Link className="flex items-center gap-2 font-bold text-sidebar-foreground" href="/">
            <Logo />
            <span className='font-headline text-lg'>CashPay</span>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsOpen(false)}>
              <X className="h-6 w-6" />
              <span className="sr-only">Close sidebar</span>
          </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <nav className="grid items-start px-4 text-sm font-medium">
          <NavLinks />
        </nav>
      </div>
       <div className="mt-auto p-4">
          {/* Future: Add user profile or other footer items here */}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar-background text-sidebar-foreground border-sidebar-border">
          {content}
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border">
        {content}
      </div>
    </>
  );
}
