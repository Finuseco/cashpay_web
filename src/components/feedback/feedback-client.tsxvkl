'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from "react-i18next";
import { format, isToday, isYesterday, isThisYear, parseISO, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User, Message, Conversation, AssistantSettings, Currency, Group, GroupMessage, Call, StatusGroup } from '@/lib/types';
import { ArrowLeft, Send, Check, CheckCheck, Paperclip, Phone, Video, Smile, Loader2, Mic, StopCircle, MoreVertical, LayoutDashboard, ShoppingCart, Clapperboard, Map, Gamepad2, Trash2, Copy, Edit2, Plus, Banknote, Undo2, FileText, Briefcase, PlayCircle, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
    postMessage, 
    transcribeVoiceMessage, 
    getAiSpokenResponse, 
    getAiChatResponse, 
    createInChatTransfer, 
    markConversationAsRead, 
    deleteMessage, 
    saveBase64Image, 
    postGroupMessage,
    getConversationsForUser,
    getConversation
} from '@/lib/actions/message.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { z } from "zod";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Badge } from '../ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import NextImage from 'next/image';
import EmojiPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { ConversationList } from './conversation-list';
import { ChatView } from './chat-view';
import { NewChatView } from './new-chat-view';
import { getStatusesForUser } from '@/lib/actions/status.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { CallView } from './call-view';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { useSearchParams } from 'next/navigation';
import { ContactProfileView } from './contact-profile-view';
import { MessageSquare } from 'lucide-react';
import { OnChatLandingPage } from './onchat-landing-page';
import { StatusViewer } from '@/components/status/status-viewer';
import { CreateGroupForm } from './groups/create-group-form';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { OnChatFooter } from './onchat-footer';
import { GroupListView } from './groups/group-list-view';
import { CallsView } from './calls-view';
import { GroupChatView } from './groups/group_chat_view';
import { NewsView } from '@/components/feedback/news-view';
import { GroupProfileView } from './groups/group-profile-view';
import { getGroupWithMessages } from '@/lib/actions/group.actions';
import { startCallSession, endCallSession } from '@/lib/actions/call.actions';


type View = 'list' | 'chat' | 'new_chat' | 'call' | 'contact_profile' | 'status' | 'create_group' | 'groups' | 'calls' | 'group_chat' | 'news' | 'group_profile';

function FeedbackLoading() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 h-full bg-zinc-900">
            <div className="col-span-1 border-r border-zinc-700 h-full p-2">
                <Skeleton className="h-12 w-full mb-4" />
                <div className="space-y-2">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-2">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="hidden md:block md:col-span-2 lg:col-span-3 h-full">
                 <div className="flex items-center justify-center h-full">
                    <div className="text-center text-zinc-500">
                         <MessageSquare className="h-16 w-16 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold">OnChat</h2>
                        <p>Chargez vos conversations...</p>
                    </div>
                 </div>
            </div>
        </div>
    );
}


export function FeedbackClient() {
    const { t } = useTranslation();
    const searchParams = useSearchParams();
    const contactIdFromUrl = searchParams.get('contactId');
    
    const [view, setView] = useState<View>('list');
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);
    const [viewedContact, setViewedContact] = useState<User | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [statusGroups, setStatusGroups] = useState<StatusGroup[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [activeCall, setActiveCall] = useState<Call | null>(null);
    const [statusViewerIndex, setStatusViewerIndex] = useState<number | null>(null);
    
    const audioFeedback = useAudioFeedback();
    const { openAlert } = useAlertDialog();

    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        const user = await getAuthenticatedUser();
        if (user) {
            setCurrentUser(user);
            const [userConversations, userStatuses] = await Promise.all([
                getConversationsForUser(user.id),
                getStatusesForUser(user.id)
            ]);
            setConversations(userConversations);
            setStatusGroups(userStatuses);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);
    
    const handleSelectConversation = useCallback(async (contact: User) => {
        if (!currentUser) return;
        
        setView('chat');
        setActiveConversation(conversations.find(c => c.contact.id === contact.id) || null);
        setActiveGroup(null);

        const fullConversation = await getConversation(currentUser.id, contact.id);
        
        if (fullConversation) {
             setActiveConversation(fullConversation);
            if (fullConversation.unreadCount > 0) {
                await markConversationAsRead(fullConversation.id, currentUser.id);
                setConversations(prev => prev.map(c => 
                    c.id === fullConversation.id ? { ...c, unreadCount: 0 } : c
                ));
            }
        }
    }, [currentUser, conversations]);
    
    useEffect(() => {
        if (contactIdFromUrl && conversations.length > 0 && currentUser) {
            const contact = conversations.find(c => c.contact.id === parseInt(contactIdFromUrl, 10))?.contact;
            if (contact) {
                handleSelectConversation(contact);
            }
        }
    }, [contactIdFromUrl, conversations, currentUser, handleSelectConversation]);

    const handleNewConversation = (user: User) => {
        const existingConversation = conversations.find(c => c.contact.id === user.id);
        if (existingConversation) {
            handleSelectConversation(user);
        } else if (currentUser) {
            handleSelectConversation(user);
        }
        setView('chat');
    }

    const handleBackToList = () => {
        setActiveConversation(null);
        setViewedContact(null);
        setActiveGroup(null);
        setView('list');
    };

    const handleOpenNewChat = () => {
        setView('new_chat');
    };

    const handleOpenStatus = () => {
        if (statusGroups.length > 0) {
            handleViewStatus(0);
        } else {
            setView('status');
        }
    }
    
    const handleCreateGroup = () => {
        setView('create_group');
    }

    const handleViewProfile = (contact: User) => {
        setViewedContact(contact);
        setView('contact_profile');
    };
    
    const handleViewGroupProfile = () => {
        setView('group_profile');
    }

    const handleUpdateConversation = (updatedConversation: Conversation) => {
        setConversations(prev => {
            const existingIndex = prev.findIndex(c => c.id === updatedConversation.id);
            let newConversations;

            if (existingIndex > -1) {
                 newConversations = [...prev];
                 newConversations[existingIndex] = updatedConversation;
            } else {
                 newConversations = [updatedConversation, ...prev];
            }
            return newConversations.sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
        });
        
        if (activeConversation?.id === updatedConversation.id) {
            setActiveConversation(updatedConversation);
        }


        if (updatedConversation.messages.length > 0 && currentUser) {
            const lastMessage = updatedConversation.messages[updatedConversation.messages.length - 1];
            if (lastMessage.senderId !== currentUser.id) {
                audioFeedback.playChatMessageSound();
            }
        }
    }

    const handleUpdateGroup = async () => {
        if (!activeGroup || !currentUser) return;
        const fullGroup = await getGroupWithMessages(activeGroup.id, currentUser.id);
        if(fullGroup) setActiveGroup(fullGroup);
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!activeConversation) return;

        const originalConversation = { ...activeConversation };
        const updatedMessages = activeConversation.messages.filter(m => m.id !== messageId);
        
        const updatedConversation = { ...activeConversation, messages: updatedMessages };
        setActiveConversation(updatedConversation);
        setConversations(prev => prev.map(c => c.id === updatedConversation.id ? updatedConversation : c));

        const result = await deleteMessage(messageId);
        if (!result.success) {
            setActiveConversation(originalConversation);
            setConversations(prev => prev.map(c => c.id === originalConversation.id ? originalConversation : c));
            openAlert({ title: "Erreur", description: result.error || "Échec de la suppression du message.", variant: 'error' });
        }
    }
    
    const startCall = async (contact: User, type: 'audio' | 'video' | 'meeting') => {
        if (!currentUser) return;
        if (type === 'meeting') {
            openAlert({title: 'Bientôt disponible', description: 'Les réunions de groupe seront bientôt disponibles.'});
            return;
        }
        const call: Call = {
            id: `call_${Date.now()}`,
            type: type,
            caller: currentUser,
            callee: contact,
            status: 'ringing'
        };
        const { sessionId } = await startCallSession(call);
        if (sessionId) {
            setActiveCall({ ...call, sessionId });
            setView('call');
        } else {
            openAlert({ title: "Erreur d'appel", description: "Impossible d'initier l'appel.", variant: 'error' });
        }
    };
    

    const endCall = (reason: Call['status']) => {
        audioFeedback.stopAllSounds();
        if (reason === 'no-answer') {
            audioFeedback.playNoAnswerSound();
        }
        if (activeCall && activeCall.sessionId) {
            endCallSession(activeCall.sessionId, reason);
        }
        setActiveCall(null);
        setView('list');
    };
    
    const handleViewStatus = (groupIndex: number) => {
        setStatusViewerIndex(groupIndex);
    };

    const handleNavigate = (newView: 'list' | 'calls' | 'groups' | 'news') => {
        setView(newView);
    };

    const handleSelectGroup = async (groupId: number) => {
        if (!currentUser) return;
        setView('group_chat');
        setActiveConversation(null); // Clear active 1-on-1 chat
        const fullGroup = await getGroupWithMessages(groupId, currentUser.id);
        if(fullGroup){
          setActiveGroup(fullGroup);
        } else {
            openAlert({title: "Erreur", description: "Impossible de charger le groupe."});
            setView('list');
        }
    }

    const renderContent = () => {
        if (view === 'new_chat') {
            return <NewChatView onBack={handleBackToList} onNewConversation={handleNewConversation} currentUser={currentUser} />;
        }
        if (view === 'create_group') {
             return <CreateGroupForm />;
        }
        if (view === 'contact_profile' && viewedContact) {
            return <ContactProfileView user={viewedContact} onBack={() => setView('chat')} onStartCall={(type) => startCall(viewedContact, type)} />;
        }
        if (view === 'group_profile' && activeGroup && currentUser) {
            return <GroupProfileView group={activeGroup} currentUser={currentUser} onBack={() => setView('group_chat')} onGroupUpdate={handleUpdateGroup} />;
        }
        if (view === 'chat' && activeConversation && currentUser) {
            return (
                <ChatView
                    key={activeConversation.id}
                    conversation={activeConversation}
                    currentUser={currentUser}
                    onBack={handleBackToList}
                    onUpdateConversation={handleUpdateConversation}
                    onViewProfile={handleViewProfile}
                    onStartCall={(contact, type) => startCall(contact, type as 'audio' | 'video')}
                    onDeleteMessage={handleDeleteMessage}
                />
            );
        }
        if (view === 'group_chat' && activeGroup && currentUser) {
            return (
                <GroupChatView
                    key={activeGroup.id}
                    group={activeGroup}
                    currentUser={currentUser}
                    onBack={handleBackToList}
                    onUpdateGroup={handleUpdateGroup}
                    onViewGroupProfile={handleViewGroupProfile}
                />
            );
        }
        if (view === 'groups' && currentUser) {
            return <GroupListView currentUser={currentUser} onBack={handleBackToList} onCreateGroup={handleCreateGroup} onSelectGroup={handleSelectGroup} />;
        }
        if (view === 'calls') {
            return <CallsView onBack={handleBackToList} />;
        }
        if (view === 'news') {
            return <NewsView onBack={handleBackToList} />;
        }

        return (
            <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#0b141a] border-l border-zinc-700/50">
                <div className="text-center text-zinc-400">
                     <MessageSquare className="h-24 w-24 mx-auto mb-4 opacity-10" />
                    <h2 className="text-2xl font-bold text-zinc-200">OnChat pour Desktop</h2>
                    <p className="max-w-xs mx-auto mt-2">Envoyez et recevez des messages sans garder votre téléphone en ligne. Utilisez OnChat sur jusqu'à 4 appareils liés en même temps.</p>
                </div>
            </div>
        );
    };

    if (isLoading) return <FeedbackLoading />;
    if (!currentUser) return <OnChatLandingPage />;
    if (activeCall && currentUser) return <CallView call={activeCall} currentUser={currentUser} onHangUp={endCall} />;
    
    const showFooter = ['list', 'calls', 'groups', 'news'].includes(view);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 h-full bg-zinc-900 relative">
          <div className={cn("h-full md:col-span-1 border-r border-zinc-800", view !== 'list' && "hidden md:block")}>
            <ConversationList
              conversations={conversations}
              onSelectContact={handleSelectConversation}
              onNewChat={handleOpenNewChat}
              onCreateGroup={handleCreateGroup}
              onOpenStatus={() => handleViewStatus(0)}
              currentUserId={currentUser.id}
              activeConversationId={activeConversation?.id}
            />
          </div>

          <div className={cn("h-full md:col-span-2 lg:col-span-3", view === 'list' && "hidden md:flex")}>
            {renderContent()}
          </div>
          
           {showFooter && (
                <div className="md:hidden">
                    <OnChatFooter activeView={view} onNavigate={handleNavigate} />
                </div>
           )}

           {statusViewerIndex !== null && (
            <StatusViewer 
                statusGroups={statusGroups}
                initialGroupIndex={statusViewerIndex}
                onClose={() => setStatusViewerIndex(null)}
            />
           )}
        </div>
    );
}
