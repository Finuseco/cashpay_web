
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Menu, Bell } from 'lucide-react';
import { UserNav } from './user-nav';

interface HeaderProps {
  setIsSidebarOpen: (isOpen: boolean) => void;
}

export default function Header({ setIsSidebarOpen }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:justify-end">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setIsSidebarOpen(true)}
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
        </Button>
        <UserNav />
      </div>
    </header>
  );
}
