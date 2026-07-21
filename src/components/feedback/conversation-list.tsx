
'use client';

import { useState } from 'react';
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User, Conversation, Message } from "@/lib/types";
import { ArrowLeft, Search, Menu, MessageSquarePlus, Settings, CheckCheck, Check, LayoutDashboard, ShoppingCart, Clapperboard, Map, Gamepad2, Briefcase, Camera, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import Link from "next/link";
import { OnChatLogo } from './on-chat-logo';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MessageStatus = ({ isSentByCurrentUser, status }: { isSentByCurrentUser: boolean, status?: Message['status'] }) => {
    if (!isSentByCurrentUser || !status) return null;
    if (status === 'read') return <CheckCheck className="h-4 w-4 text-blue-400 mr-1" />;
    if (status === 'delivered') return <CheckCheck className="h-4 w-4 text-zinc-400 mr-1" />;
    return <Check className="h-4 w-4 text-zinc-400 mr-1" />;
};


interface ConversationListProps {
  conversations: Conversation[];
  onSelectContact: (contact: User) => void;
  onNewChat: () => void;
  onOpenStatus: () => void;
  onCreateGroup: () => void;
  currentUserId?: number;
  activeConversationId?: string | null;
}

const formatTimestamp = (timestamp: string, t: any) => {
    try {
        const date = new Date(timestamp);
        if (isToday(date)) {
            return format(date, 'HH:mm');
        }
        if (isYesterday(date)) {
            return t('yesterday', 'Yesterday');
        }
        return format(date, 'dd/MM/yy', { locale: fr });
    } catch(e) {
        return 'Invalid date';
    }
};

const ConversationItem = ({ conv, onSelect, currentUserId, isActive }: { conv: Conversation, onSelect: (contact: User) => void, currentUserId?: number, isActive: boolean }) => {
    const { t } = useTranslation();
    const displayName = `${conv.contact.first_name || ''} ${conv.contact.last_name || ''}`.trim();
    const lastMessage = conv.messages[conv.messages.length - 1];
    const isSentByCurrentUser = lastMessage?.senderId === currentUserId;

    let displayMessage = conv.lastMessage;
    if (conv.lastMessage && conv.lastMessage.startsWith('{')) {
        try {
          const parsed = JSON.parse(conv.lastMessage);
          if (parsed.type === 'in_chat_transfer') {
            displayMessage = 'Proposition de transfert';
          }
        } catch(e) {
            // Not a JSON message, keep original content
        }
    }

    return (
        <div
            className={cn("flex items-center gap-4 p-2 rounded-lg cursor-pointer transition-colors", isActive ? "bg-zinc-700" : "hover:bg-zinc-800")}
            onClick={() => onSelect(conv.contact)}
        >
            <div className="relative">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={conv.contact.profile_photo || ''} alt={conv.contact.full_name} data-ai-hint="person portrait" />
                    <AvatarFallback>
                        {conv.contact.first_name?.[0]}{conv.contact.last_name?.[0]}
                    </AvatarFallback>
                </Avatar>
                {conv.contact.availabilityStatus === 'available' ? (
                    <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-[#111827]" />
                ) : (
                    <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-zinc-500 ring-2 ring-[#111827]" />
                )}
            </div>
            <div className="flex-1 min-w-0 border-t border-zinc-700/50 py-3">
                <div className="flex justify-between items-center">
                    <p className="font-semibold truncate text-white flex-1 min-w-0">{displayName}</p>
                    <p className="text-xs text-zinc-400 whitespace-nowrap pl-2">{formatTimestamp(conv.lastMessageTimestamp, t)}</p>
                </div>
                 <div className="flex justify-between items-center">
                    <p className="text-sm text-zinc-400 truncate flex items-center">
                        <MessageStatus isSentByCurrentUser={isSentByCurrentUser} status={lastMessage?.status} />
                        {displayMessage}
                    </p>
                    {conv.unreadCount > 0 && (
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500 text-black text-xs font-bold">
                            {conv.unreadCount}
                        </span>
                    )}
                 </div>
            </div>
        </div>
    );
};


export function ConversationList({ conversations, onSelectContact, onNewChat, onOpenStatus, onCreateGroup, currentUserId, activeConversationId }: ConversationListProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("chats");

  const filteredConversations = useMemo(() => {
    if (!searchTerm) {
      return conversations;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return conversations.filter(c => 
      c.contact.full_name.toLowerCase().includes(lowercasedTerm)
    );
  }, [conversations, searchTerm]);

  return (
    <div className="h-full flex flex-col bg-[#111827] text-white">
       <header className="flex flex-col p-2 sm:p-3 shrink-0 bg-[#1f2c33]">
          <div className="flex items-center justify-between">
             <OnChatLogo />
             <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white rounded-full" onClick={onNewChat}>
                   <MessageSquarePlus />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white rounded-full"><Menu /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-zinc-800 border-zinc-700 text-white">
                        <DropdownMenuItem className="focus:bg-zinc-700" onClick={onCreateGroup}><UsersIcon className="mr-2 h-4 w-4"/> Nouveau Groupe</DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-zinc-700" onClick={onNewChat}>Nouveau Chat</DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-zinc-700">Paramètres</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
             </div>
          </div>
          <Tabs defaultValue="chats" className="w-full mt-2" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 bg-transparent p-0">
                    <TabsTrigger value="community" className="pb-3 rounded-none text-white/70 data-[state=active]:text-green-400 data-[state=active]:border-b-2 data-[state=active]:border-green-400 data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                       Communauté
                    </TabsTrigger>
                    <TabsTrigger value="chats" className="pb-3 rounded-none text-white/70 data-[state=active]:text-green-400 data-[state=active]:border-b-2 data-[state=active]:border-green-400 data-[state=active]:shadow-none data-[state=active]:bg-transparent">
                       {t('chatsTab', 'Chats')}
                    </TabsTrigger>
                    <TabsTrigger value="status" className="pb-3 rounded-none text-white/70 data-[state=active]:text-green-400 data-[state=active]:border-b-2 data-[state=active]:border-green-400 data-[state=active]:shadow-none data-[state=active]:bg-transparent" onClick={onOpenStatus}>
                       {t('statusTab', 'Status')}
                    </TabsTrigger>
                </TabsList>
           </Tabs>
       </header>

       {activeTab === 'chats' && (
           <>
            <div className="p-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                    <Input 
                        placeholder={t('chatSearchContactsPlaceholder')}
                        className="pl-10 bg-zinc-800 border-zinc-700 h-10 rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-0 pb-16">
                {filteredConversations.length > 0 ? (
                    filteredConversations.map((conv) => (
                    <ConversationItem key={conv.id} conv={conv} onSelect={onSelectContact} currentUserId={currentUserId} isActive={conv.id === activeConversationId} />
                    ))
                ) : (
                    <div className="text-center py-20 text-zinc-500">
                        <p>{t('noConversationsFound')}</p>
                    </div>
                )}
                </div>
            </ScrollArea>
           </>
       )}
    </div>
  );
}
