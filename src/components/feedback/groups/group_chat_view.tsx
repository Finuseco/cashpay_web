
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Group, User, GroupMessage, Message, Conversation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Paperclip, Mic, MoreVertical, Phone, Video, Users as UsersIcon, ThumbsUp, Download, Share2, Forward, FileText, Trash2, ShoppingBag, X, Maximize2, ShoppingCart, Smile, Plus, StopCircle, PlayCircle, Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { postGroupMessage, deleteMessage, getConversationsForUser, forwardMessage } from '@/lib/actions/message.actions';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import NextImage from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import Link from 'next/link';
import EmojiPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';

/**
 * Composant local pour afficher une carte produit JoJo partagée dans le groupe.
 */
const ProductCardMessage = ({ metadata }: { metadata: string }) => {
    try {
        const product = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        return (
            <Card className="overflow-hidden border-zinc-700 bg-zinc-800 text-white w-64 shadow-xl">
                <div className="relative aspect-square">
                    <NextImage src={product.image} alt={product.name} fill className="object-cover" />
                    <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">JoJo Shopping</div>
                </div>
                <CardContent className="p-3 space-y-2">
                    <h4 className="font-bold text-sm line-clamp-1">{product.name}</h4>
                    <p className="text-primary font-bold text-lg">${Number(product.price).toFixed(2)}</p>
                    <Button asChild variant="gradient" className="w-full h-9 text-xs font-bold rounded-full">
                        <Link href={`/shopping/${product.productId}`}>
                            <ShoppingCart className="mr-2 h-3.5 w-3.5" /> Commander
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        );
    } catch (e) { 
        return <div className="p-4 text-destructive bg-red-500/10 rounded font-bold text-xs">Erreur chargement produit</div>; 
    }
};

/**
 * Composant local pour lire un message vocal.
 */
const VoiceMessagePlayer = ({ message, senderAvatar }: { message: GroupMessage; senderAvatar?: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
    };

    const fileDetails = message.metadata ? (typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata) : null;

    return (
        <div className="flex items-center gap-2 p-2 min-w-[200px]">
            <audio ref={audioRef} src={fileDetails?.fileUrl} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} preload="metadata" />
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={senderAvatar} />
                <AvatarFallback>?</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white" onClick={togglePlay}>
                {isPlaying ? <StopCircle className="h-5 w-5"/> : <PlayCircle className="h-5 w-5"/>}
            </Button>
            <div className="w-full h-1 bg-zinc-600 rounded-full relative">
                <div className="h-1 bg-white rounded-full" style={{ width: `${progress}%` }}></div>
                <div className="absolute h-3 w-3 bg-white rounded-full -top-1" style={{ left: `calc(${progress}% - 6px)` }}></div>
            </div>
        </div>
    );
}

/**
 * Bulle de message spécifique pour le groupe.
 */
const GroupMessageBubble = ({ 
    message, 
    sender,
    currentUser,
    onDelete,
    onForward,
    onImageClick
}: { 
    message: GroupMessage, 
    sender: any,
    currentUser: User,
    onDelete: (id: string) => void,
    onForward: (msg: Message) => void,
    onImageClick: (url: string) => void
}) => {
    const isSentByCurrentUser = message.senderId === currentUser.id;
    let fileData: any = null;
    if (message.metadata) {
        try { fileData = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata; } catch(e) {}
    }

    const isImage = message.type === 'image';
    const isAudio = message.type === 'audio';
    const isDoc = message.type === 'doc';
    const isProduct = message.type === 'product';

    // Récupération de l'URL de l'image (via metadata ou ID)
    const imageUrl = fileData?.fileUrl || (message.image_id ? `/images/chat-files/sender_${message.senderId}/${message.image_id}.jpg` : null);

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = fileData?.fileName || 'image.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={cn("flex w-full items-end gap-2 group", isSentByCurrentUser ? "justify-end" : "justify-start")}>
            <div className={cn("flex items-center", isSentByCurrentUser && "order-1")}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 shrink-0 text-zinc-400">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-zinc-800 border-zinc-700 text-white">
                        <DropdownMenuItem className="focus:bg-zinc-700" onClick={() => onForward(message)}><Forward className="mr-2 h-4 w-4"/> Transférer</DropdownMenuItem>
                        {isSentByCurrentUser && <DropdownMenuItem className="focus:bg-zinc-700 text-red-400" onClick={() => onDelete(message.id)}><Trash2 className="mr-2 h-4 w-4"/> Supprimer</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex flex-col gap-1 max-w-[75%]">
                {!isSentByCurrentUser && <span className="text-[10px] text-zinc-400 px-1 font-bold">{sender?.full_name}</span>}
                <div className={cn(
                    "rounded-lg shadow-sm relative",
                    isSentByCurrentUser ? "bg-[#005c4b] text-white rounded-br-none" : "bg-[#2a3942] text-white rounded-bl-none",
                    (isImage || isAudio || isProduct) ? "p-1" : "p-2 min-w-[100px]"
                )}>
                    {isProduct ? (
                        <ProductCardMessage metadata={message.metadata!} />
                    ) : isDoc && fileData?.fileUrl ? (
                        <a href={fileData.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/20 rounded-md p-2">
                            <FileText className="h-8 w-8 text-white"/>
                            <div className="flex-1">
                                <p className="font-semibold text-xs line-clamp-1">{fileData.fileName}</p>
                            </div>
                        </a>
                    ) : isImage && imageUrl ? (
                        <div className="flex flex-col gap-1">
                            <div className="relative group/img cursor-pointer" onClick={() => onImageClick(imageUrl)}>
                                <NextImage src={imageUrl} alt="group image" width={250} height={250} className="rounded-md object-cover" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                                    <Maximize2 className="h-8 w-8 text-white/80" />
                                </div>
                            </div>
                            <div className="flex justify-around items-center py-1 border-t border-white/10 mt-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={(e) => { e.stopPropagation(); }}><ThumbsUp className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={handleDownload}><Download className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={(e) => { e.stopPropagation(); onForward(message); }}><Forward className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    ) : isAudio ? (
                        <VoiceMessagePlayer message={message} senderAvatar={sender?.profile_photo || undefined} />
                    ) : (
                        <p className="text-sm px-1 leading-relaxed">{message.content}</p>
                    )}
                    
                    <div className="flex items-center justify-end gap-1 mt-1 px-1 pb-1">
                        <span className="text-[9px] text-white/50">{format(new Date(message.timestamp), 'HH:mm')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DateSeparator = ({ date }: { date: string }) => {
    const messageDate = parseISO(date);
    let formattedDate;

    if (isToday(messageDate)) {
        formattedDate = "Aujourd'hui";
    } else if (isYesterday(messageDate)) {
        formattedDate = "Hier";
    } else {
        formattedDate = format(messageDate, 'd MMMM yyyy', { locale: fr });
    }

    return (
        <div className="flex justify-center my-4">
            <div className="px-3 py-1 text-[10px] text-white font-bold bg-[#1f2c33] rounded-full shadow-md uppercase tracking-wider">
                {formattedDate}
            </div>
        </div>
    );
};

export function GroupChatView({ group: initialGroup, currentUser, onBack, onUpdateGroup, onViewGroupProfile }: { group: Group, currentUser: User, onBack: () => void, onUpdateGroup: (group: Group) => void, onViewGroupProfile: (group: Group) => void }) {
    const { toast } = useToast();
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [group, setGroup] = useState(initialGroup);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
    const [messageToForward, setMessageToForward] = useState<Message | null>(null);
    const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);

    useEffect(() => {
        setGroup(initialGroup);
    }, [initialGroup]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [group.messages]);

    const handleSendMessage = async (type: Message['type'] = 'text', fileDataUri?: string, fileName?: string) => {
        if (!newMessage.trim() && !fileDataUri) return;

        setIsSending(true);
        const tempId = `temp-${Date.now()}`;
        const content = type === 'text' ? newMessage : (type === 'image' ? '📷 Photo' : (type === 'doc' ? '📄 Document' : (type === 'audio' ? '🎤 Message vocal' : newMessage)));
        
        const tempMessage: GroupMessage = {
            id: tempId,
            senderId: currentUser.id,
            content: content,
            timestamp: new Date().toISOString(),
            type: type,
            status: 'sent',
            groupId: group.id,
            metadata: fileDataUri ? JSON.stringify({ fileUrl: fileDataUri, fileName }) : undefined
        };

        const optimisticGroup = { ...group, messages: [...group.messages, tempMessage] };
        onUpdateGroup(optimisticGroup);
        setNewMessage("");

        try {
            const sentMessage = await postGroupMessage(group.id, currentUser.id, content, type, fileDataUri, fileName);
            const finalGroup = {
                ...optimisticGroup,
                messages: optimisticGroup.messages.map(m => m.id === tempId ? { ...sentMessage, senderId: currentUser.id } as GroupMessage : m),
            };
            onUpdateGroup(finalGroup);
        } catch (e) {
            toast({ variant: 'destructive', title: "Erreur", description: "Échec de l'envoi du message." });
        } finally {
            setIsSending(false);
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                await handleSendMessage(file.type.startsWith('image') ? 'image' : 'doc', dataUrl, file.name);
            };
            reader.readAsDataURL(file);
        }
    };

    const openForwardDialog = async (message: Message) => {
        setMessageToForward(message);
        setIsForwardDialogOpen(true);
        const convs = await getConversationsForUser(currentUser.id);
        setRecentConversations(convs);
    }

    const handleForwardTo = async (targetId: string | number, type: 'conversation' | 'group') => {
        if (!messageToForward) return;
        
        setIsSending(true);
        const result = await forwardMessage(currentUser.id, messageToForward.id, type, targetId);
        setIsSending(false);

        if (result.success) {
            setIsForwardDialogOpen(false);
            setMessageToForward(null);
            toast({ title: "Message transféré", variant: "success" });
        }
    }
    
    return (
        <div className="flex flex-col h-full bg-[#0b141a] text-white">
            <header className="flex items-center p-2 sm:p-3 shrink-0 bg-[#1f2c33] border-b border-zinc-700/50">
                <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden"><ArrowLeft /></Button>
                <div className="ml-2 flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => onViewGroupProfile(group)}>
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                        <AvatarImage src={group.photo_url || ''} />
                        <AvatarFallback>{group.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <h2 className="font-bold text-base truncate">{group.name}</h2>
                        <p className="text-xs text-zinc-400">{group.member_count} membres • {group.balance.toFixed(2)} {group.currency}</p>
                    </div>
                </div>
                 <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon"><Video /></Button>
                    <Button variant="ghost" size="icon"><Phone /></Button>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-zinc-800 border-zinc-700 text-white">
                             <DropdownMenuItem className="focus:bg-zinc-700" onClick={() => onViewGroupProfile(group)}>
                                <UsersIcon className="mr-2 h-4 w-4"/> Infos du groupe
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
                <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 bg-transparent border-none shadow-none flex items-center justify-center">
                    <div className="relative w-full h-full flex items-center justify-center">
                        <NextImage src={lightboxUrl!} alt="lightbox" width={1200} height={1200} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
                        <Button variant="ghost" size="icon" className="absolute -top-10 right-0 text-white" onClick={() => setLightboxUrl(null)}><X /></Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isForwardDialogOpen} onOpenChange={setIsForwardDialogOpen}>
                <DialogContent className="p-0 bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader className="p-4 border-b border-zinc-800">
                        <DialogTitle>Transférer à...</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] p-2">
                        <div className="space-y-1">
                            {recentConversations.map(c => (
                                <button 
                                    key={c.id} 
                                    className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-lg transition-colors text-left"
                                    onClick={() => handleForwardTo(c.id, 'conversation')}
                                >
                                    <Avatar><AvatarImage src={c.contact.profile_photo || ''}/><AvatarFallback>{c.contact.first_name?.[0]}</AvatarFallback></Avatar>
                                    <div>
                                        <p className="font-semibold text-white">{c.contact.full_name}</p>
                                        <p className="text-xs text-zinc-400">@ {c.contact.id_wallet}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <ScrollArea className="flex-1" viewportRef={scrollAreaRef}>
                <div className="p-4 space-y-4">
                    {group.messages.map((message, index) => {
                        const prevMessage = group.messages[index - 1];
                        const showDateSeparator = !prevMessage || format(new Date(prevMessage.timestamp), 'yyyy-MM-dd') !== format(new Date(message.timestamp), 'yyyy-MM-dd');
                        const sender = group.members.find(m => m.id === message.senderId);
                        
                        return (
                            <div key={message.id}>
                                {showDateSeparator && <DateSeparator date={message.timestamp} />}
                                <GroupMessageBubble 
                                    message={message} 
                                    sender={sender} 
                                    currentUser={currentUser} 
                                    onDelete={(id) => deleteMessage(id).then(res => res.success && onUpdateGroup({ ...group, messages: group.messages.filter(m => m.id !== id) }))}
                                    onForward={(msg) => openForwardDialog(msg)}
                                    onImageClick={setLightboxUrl}
                                />
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
             <footer className="p-2 border-t border-zinc-700/50 bg-[#1f2c33] shrink-0">
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white rounded-full h-11 w-11 bg-[#2a3942] hover:bg-zinc-700/80"><Smile/></Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 border-0 bg-transparent w-auto">
                            <EmojiPicker data={data} onEmojiSelect={(emoji: any) => setNewMessage(prev => prev + emoji.native)} theme="dark" />
                        </PopoverContent>
                    </Popover>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white rounded-full h-11 w-11 bg-[#2a3942] hover:bg-zinc-700/80"><Plus/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" className="bg-zinc-800 border-zinc-700 text-white">
                            <DropdownMenuItem className="focus:bg-zinc-700" onClick={() => fileInputRef.current?.click()}><Paperclip className="mr-2 h-4 w-4"/> Document / Image</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*,application/pdf" />
                    <Input
                        placeholder="Écrire un message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                        className="bg-[#2a3942] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-11 rounded-lg px-4 text-white placeholder:text-zinc-400"
                    />
                    {newMessage.trim() ? (
                        <Button size="icon" className="rounded-full bg-primary hover:bg-primary/90 h-11 w-11" onClick={() => handleSendMessage()} disabled={isSending}>
                            <Send />
                        </Button>
                    ) : (
                        <Button size="icon" className="rounded-full bg-primary hover:bg-primary/90 h-11 w-11" onClick={() => {}}>
                            <Mic />
                        </Button>
                    )}
                </div>
            </footer>
        </div>
    );
}
