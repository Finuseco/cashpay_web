
"use client";

import { useState } from 'react';
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User } from "@/lib/types";
import { ArrowLeft, Search } from "lucide-react";

interface ContactListProps {
  contacts: User[];
  onSelectContact: (contact: User) => void;
  onBack: () => void;
}

export function ContactList({ contacts, onSelectContact, onBack }: ContactListProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = contacts.filter(contact => 
    contact.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.id_wallet.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-4 p-2 sm:p-4 border-b shrink-0 bg-card">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div>
            <h2 className="font-bold text-lg">{t('chatContactsTitle', 'My Contacts')}</h2>
            <p className="text-sm text-muted-foreground">{contacts.length} {t('chatContactsCount', 'contacts')}</p>
        </div>
      </header>
      <div className="p-2 border-b">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
                placeholder={t('chatSearchContactsPlaceholder', 'Search contacts...')}
                className="pl-10 bg-muted border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-11 rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted cursor-pointer"
              onClick={() => onSelectContact(contact)}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={contact.profile_photo || ''} alt={contact.full_name} data-ai-hint="person portrait" />
                <AvatarFallback>
                    {contact.first_name?.[0]}{contact.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">{contact.full_name}</p>
                <p className="text-sm text-muted-foreground">{contact.id_wallet}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
