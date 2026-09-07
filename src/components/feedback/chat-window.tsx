
'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from "react-i18next";
import { 
    Send, Smile, Paperclip, MoreVertical, Phone, Video, 
    ArrowLeft, Check, Loader2, Download, Copy, Share2 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Conversation, Message, User } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { postMessage, getNewMessages, markConversationAsRead } from '@/lib/actions/message.actions';
import { initiateCall, type CallType } from '@/lib/actions/call.actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CallInviteBubble = ({ message, isMe }: { message: Message, isMe: boolean }) => {
    const metadata = message.metadata ? (typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata) : {};
    const [elapsed, setElapsed] = useState(0);
    const isActive = metadata.status === 'active' || metadata.status === 'ringing';
    const isEnded = metadata.status === 'ended' || metadata.status === 'missed';

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive) {
            interval = setInterval(() => {
                const start = new Date(metadata.startedAt || message.timestamp).getTime();
                setElapsed(Math.floor((Date.now() - start) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, metadata.startedAt, message.timestamp]);

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(metadata.joinUrl);
        alert("Lien de réunion copié !");
    };

    return (
        <div className={cn("p-4 rounded-2xl border-2 w-full max-w-xs space-y-3 shadow-xl animate-in zoom-in-95", 
            isActive ? "border-green-500 bg-green-50/50" : "border-zinc-200 bg-white",
            isEnded && metadata.status === 'missed' && "border-red-400 bg-red-50/50"
        )}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-full", isActive ? "bg-green-500 text-white animate-pulse" : "bg-zinc-100 text-zinc-400")}>
                        {metadata.type === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                            {metadata.type === 'video' ? 'Appel Vidéo' : 'Appel Audio'}
                        </p>
                        <p className="text-xs font-bold">
                            {isActive ? 'En cours...' : (metadata.status === 'missed' ? 'Appel manqué' : 'Appel terminé')}
                        </p>
                    </div>
                </div>
                {isActive && <Badge className="bg-green-600 font-mono text-[10px]">{formatTime(elapsed)}</Badge>}
            </div>

            <p className="text-sm font-medium text-zinc-700 leading-tight">
                {isMe ? "Vous avez lancé cet appel" : "Invitation à rejoindre la session"}
            </p>

            <div className="flex gap-2">
                {!isEnded && (
                    <Button asChild className={cn("flex-1 font-bold h-10", isActive ? "bg-green-600 hover:bg-green-700" : "bg-primary")}>
                        <Link href={metadata.joinUrl}>REJOINDRE</Link>
                    </Button>
                )}
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handleCopy} title="Copier le lien">
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

const MessageBubble = ({ message, isMe }: { message: Message, isMe: boolean }) => {
    const metadata = message.metadata ? (typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata) : {};

    if (message.type === 'meeting_link' || message.type === 'call_invite') {
        return (
            <div className={cn("flex w-full mb-4", isMe ? "justify-end" : "justify-start")}>
                <CallInviteBubble message={message} isMe={isMe} />
            </div>
        );
    }

    return (
        <div className={cn(
            "flex w-full mb-4 animate-in fade-in slide-in-from-bottom-2",
            isMe ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[75%] p-3 rounded-2xl shadow-sm",
                isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-zinc-100 text-zinc-900 border border-zinc-100 rounded-tl-none"
            )}>
                {message.type === 'image' && metadata.fileUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden border">
                        <img src={metadata.fileUrl} alt="Photo" className="max-w-full h-auto object-cover" />
                    </div>
                )}
                
                {message.type === 'doc' && metadata.fileUrl && (
                    <a href={metadata.fileUrl} target="_blank" download className="flex items-center gap-3 p-3 bg-black/5 rounded-xl mb-1 hover:bg-black/10 transition-colors border">
                        <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Download className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{metadata.fileName || 'Document'}</p>
                            <p className="text-[10px] opacity-50 uppercase tracking-tighter">Cliquez pour télécharger</p>
                        </div>
                    </a>
                )}

                {message.type === 'text' && <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>}
                
                <div className="flex items-center justify-end gap-1 mt-1 opacity-40">
                    <p className="text-[9px] uppercase font-bold">
                        {format(new Date(message.timestamp), 'HH:mm')}
                    </p>
                    {isMe && message.status === 'read' && <Check className="h-3 w-3" />}
                </div>
            </div>
        </div>
    );
};

export function ChatWindow({ conversation, user, onBack }: { conversation: Conversation, user: User, onBack: () => void }) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>(conversation.messages);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const interval = setInterval(async () => {
            const lastId = messages.length > 0 ? messages[messages.length - 1].id : '0';
            const news = await getNewMessages(conversation.id, lastId);
            if (news.length > 0) {
                setMessages(prev => [...prev, ...news]);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [conversation.id, messages]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        markConversationAsRead(conversation.id, user.id);
    }, [messages, conversation.id, user.id]);

    const handleSendMessage = async (type: Message['type'] = 'text', fileData?: string, fileName?: string, customMetadata?: any) => {
        if (!inputValue.trim() && !fileData && !customMetadata) return;

        const content = inputValue || (customMetadata ? "Invitation d'appel" : "");
        setInputValue('');
        setShowEmojiPicker(false);
        setIsSending(true);

        try {
            const newMessage = await postMessage({
                conversationId: conversation.id,
                content,
                type,
                senderId: user.id,
                receiverId: conversation.contact.id,
                fileDataUri: fileData,
                fileName,
                metadata: customMetadata ? JSON.stringify(customMetadata) : undefined
            });

            setMessages(prev => [...prev, newMessage]);
            return newMessage;
        } catch (e) {
            toast({ title: "Erreur", description: "Impossible d'envoyer le message.", variant: 'destructive' });
        } finally {
            setIsSending(false);
        }
    };

    const handleStartCall = async (type: CallType) => {
        setIsSending(true);
        try {
            const result = await initiateCall({
                callerId: user.id,
                receiverId: conversation.contact.id,
                type
            });

            if (result.success && result.inviteLink) {
                await handleSendMessage('call_invite', undefined, undefined, {
                    type,
                    status: 'ringing',
                    joinUrl: result.inviteLink,
                    callId: result.callId,
                    startedAt: new Date().toISOString()
                });
                router.push(result.inviteLink);
            }
        } catch (e: any) {
            toast({ title: "Erreur Appel", description: e.message, variant: 'destructive' });
        } finally {
            setIsSending(false);
        }
    };

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const type = file.type.startsWith('image') ? 'image' : 'doc';
            handleSendMessage(type, reader.result as string, file.name);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 relative overflow-hidden">
            <header className="h-16 flex items-center justify-between px-4 bg-white border-b z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden"><ArrowLeft className="h-5 w-5"/></Button>
                    <div className="relative">
                        <Avatar className="h-10 w-10 border-2 border-primary/5">
                            <AvatarImage src={conversation.contact.profile_photo || ''} />
                            <AvatarFallback className="bg-primary/10 text-primary font-black">{conversation.contact.first_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white shadow-sm" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-black text-sm text-zinc-900 truncate">{conversation.contact.full_name}</p>
                        <p className="text-[10px] text-green-600 font-black uppercase tracking-widest animate-pulse">En ligne</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-blue-50 text-blue-600" onClick={() => handleStartCall('video')} disabled={isSending}>
                        <Video className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-zinc-100 text-zinc-600" onClick={() => handleStartCall('audio')} disabled={isSending}>
                        <Phone className="h-5 w-5"/>
                    </Button>
                </div>
            </header>

            <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
                <div className="max-w-3xl mx-auto pb-10">
                    {messages.map((msg) => (
                        <MessageBubble key={msg.id} message={msg} isMe={msg.senderId === user.id} />
                    ))}
                </div>
            </ScrollArea>

            <div className="p-4 bg-white border-t">
                <div className="max-w-3xl mx-auto relative">
                    <AnimatePresence>
                        {showEmojiPicker && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-16 left-0 z-50 shadow-2xl">
                                <Picker data={data} onEmojiSelect={(emoji: any) => setInputValue(prev => prev + emoji.native)} theme="light" locale="fr" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center">
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-zinc-400" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                <Smile className="h-5 w-5"/>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-zinc-400" onClick={() => fileInputRef.current?.click()}>
                                <Paperclip className="h-5 w-5"/>
                            </Button>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={onFileSelect} />
                        <div className="relative flex-1">
                            <Input 
                                placeholder="Écrivez un message..." 
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                className="bg-zinc-100 border-none h-11 rounded-2xl pr-12"
                            />
                            <Button onClick={() => handleSendMessage()} disabled={!inputValue.trim() || isSending} className="absolute right-1 top-1 h-9 w-9 rounded-xl p-0">
                                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
