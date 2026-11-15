
'use client';

import {
  ActionPanel,
  ActionPanelContent,
  ActionPanelItem,
  ActionPanelLabel,
  ActionPanelSeparator,
  ActionPanelTrigger,
} from '@/components/ui/action-panel';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User as UserIcon } from 'lucide-react';

export function UserNav() {
  const user = { name: 'John Doe', email: 'john.doe@example.com' }; // Mock user

  return (
    <ActionPanel>
      <ActionPanelTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/avatars/01.png" alt="@shadcn" />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </ActionPanelTrigger>
      <ActionPanelContent className="w-56" align="end" forceMount>
        <ActionPanelLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </ActionPanelLabel>
        <ActionPanelSeparator />
        <ActionPanelItem>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profil</span>
        </ActionPanelItem>
        <ActionPanelSeparator />
        <ActionPanelItem>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Déconnexion</span>
        </ActionPanelItem>
      </ActionPanelContent>
    </ActionPanel>
  );
}
