'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from "react-i18next";
import { format, isToday, isYesterday, isThisYear, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User, Message, Conversation, AssistantSettings, Currency } from '@/lib/types';
import { ArrowLeft, Send, Check, CheckCheck, Paperclip, Phone, Video, Smile, Loader2, Mic, StopCircle, MoreVertical, LayoutDashboard, ShoppingCart, Clapperboard, Map, Gamepad2, Trash2, Copy, Plus, Banknote, FileText, Briefcase, PlayCircle, Users as UsersIcon, Wand2, X, CheckCircle2, Wand, Download, ThumbsUp, Share2, Forward, ShoppingBag, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { postMessage, markConversationAsRead, deleteMessage, createInChatTransfer, forwardMessage, getConversationsForUser } from '@/lib/actions/message.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { z } from "zod";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import NextImage from 'next/image';
import EmojiPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Card, CardContent } from "@/components/ui/card";
import { sendChatMessage, fetchChatMessages } from '@/lib/onchat-client';

const transferSchema = z.object({
  amount: z.coerce.number().min(0.01, "Le montant doit être positif."),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  pin: z.string().length(4, "Le PIN à 4 chiffres est requis."),
});

const InChatTransferForm = ({
  onSubmit,
  currencies,
  currentUser,
}: {
  onSubmit: (values: z.infer<typeof transferSchema>) => void;
  currencies: Currency[];
  currentUser: User;
}) => {
  const { t } = useTranslation();

  const form = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      currency: currencies[0]?.code || 'USD',
      amount: undefined,
      pin: '',
    },
  });

  const selectedCurrencyCode = form.watch('currency');

  const selectedCurrency = currencies.find(
    (currency) => currency.code === selectedCurrencyCode
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
      >
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Montant</FormLabel>

              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...field}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Devise</FormLabel>

              <FormControl>
                <div role="radiogroup" aria-label="Devise" className="grid grid-cols-2 gap-2">
                  {currencies.map((currency) => {
                    const selected =
                      field.value === currency.code;

                    return (
                      <button
                        key={currency.code}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          field.onChange(currency.code)
                        }
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/15 text-white"
                            : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-4 w-4 rounded-full border flex items-center justify-center",
                              selected
                                ? "border-primary"
                                : "border-zinc-500"
                            )}
                          >
                            {selected && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </span>

                          <span className="font-semibold">
                            {currency.code}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-zinc-400">
                          Solde : {currency.balance}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        {selectedCurrency && (
          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
            <p className="text-xs text-zinc-400">
              Solde disponible
            </p>

            <p className="font-semibold text-white">
              {selectedCurrency.balance} {selectedCurrency.code}
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="pin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code PIN</FormLabel>

              <FormControl>
                <InputOTP
                  maxLength={4}
                  value={field.value}
                  onChange={field.onChange}
                >
                  <InputOTPGroup className="mx-auto">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          variant="gradient"
          className="w-full"
        >
          {t('proposeTransferButton')}
        </Button>
      </form>
    </Form>
  );
};

const VoiceMessagePlayer = ({ message, senderAvatar }: { message: Message; senderAvatar?: string }) => {
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

    const fileDetails = message.metadata ? JSON.parse(message.metadata) : null;

    return (
        <div className="flex items-center gap-2 p-2">
            <audio ref={audioRef} src={fileDetails?.fileUrl} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} preload="metadata" />
            <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={senderAvatar} />
                <AvatarFallback>?</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={togglePlay}>
                {isPlaying ? <StopCircle className="h-6 w-6"/> : <PlayCircle className="h-6 w-6"/>}
            </Button>
            <div className="w-full h-1 bg-zinc-600 rounded-full relative">
                <div className="h-1 bg-white rounded-full" style={{ width: `${progress}%` }}></div>
                <div className="absolute h-3 w-3 bg-white rounded-full -top-1" style={{ left: `calc(${progress}% - 6px)` }}></div>
            </div>
        </div>
    );
}

const ProductCardMessage = ({ metadata }: { metadata: string }) => {
    try {
        const product = JSON.parse(metadata);
        return (
            <Card className="overflow-hidden border-zinc-700 bg-zinc-800 text-white w-64 shadow-xl">
                <div className="relative aspect-square">
                    <NextImage src={product.image} alt={product.name} fill className="object-cover" />
                    <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">JoJo Shopping</div>
                </div>
                <CardContent className="p-3 space-y-2">
                    <h4 className="font-bold text-sm line-clamp-1">{product.name}</h4>
                    <p className="text-primary font-bold text-lg">${product.price.toFixed(2)}</p>
                    <Button asChild variant="gradient" className="w-full h-9 text-xs font-bold rounded-full">
                        <Link href={`/shopping/${product.productId}`}>
                            <ShoppingCart className="mr-2 h-3.5 w-3.5" /> Commander
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        );
    } catch (e) { return <div className="p-4 text-destructive bg-red-500/10 rounded">Erreur chargement produit</div>; }
};

const MessageBubble = ({ 
    message, 
    currentUser, 
    sender, 
    onDeleteMessage,
    onForward,
    onImageClick
}: { 
    message: Message, 
    currentUser: User, 
    sender?: User, 
    onDeleteMessage: (messageId: string) => void,
    onForward: (message: Message) => void,
    onImageClick: (url: string) => void
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isSentByCurrentUser =
  Number(message.senderId) === Number(currentUser.id);
  
  let transferData = null;
  let fileData: { fileUrl: string, fileName?: string, imageId?: string } | null = null;
  
  const isAudio = message.type === 'audio';
  const isDocument = message.type === 'doc';
  const isImage = message.type === 'image';
  const isProduct = message.type === 'product';

  if (message.content?.startsWith('{')) {
      try {
          const parsedContent = JSON.parse(message.content);
          if (parsedContent && parsedContent.type === 'in_chat_transfer') {
              transferData = parsedContent;
          }
      } catch (e) {}
  }
  
  if (message.metadata) {
    try {
      fileData = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata;
    } catch(e) {}
  }

  const MessageStatus = () => {
    if (!isSentByCurrentUser || !message.status) return null;
    if (message.status === 'read') return <CheckCheck className="h-4 w-4 text-blue-400" />;
    if (message.status === 'delivered') return <CheckCheck className="h-4 w-4 text-zinc-400" />;
    return <Check className="h-4 w-4 text-zinc-400" />;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast({ title: t('toastCopied'), description: t('messageCopied') });
  }

  const handleDownload = () => {
      if (!fileData?.fileUrl) return;
      const link = document.createElement('a');
      link.href = fileData.fileUrl;
      link.download = fileData.fileName || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }

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
                    {!isAudio && !isImage && !isDocument && !isProduct && <DropdownMenuItem className="focus:bg-zinc-700" onClick={handleCopy}><Copy className="mr-2 h-4 w-4"/> {t('copyButton')}</DropdownMenuItem>}
                    {(isImage || isDocument) && <DropdownMenuItem className="focus:bg-zinc-700" onClick={handleDownload}><Download className="mr-2 h-4 w-4"/> Télécharger</DropdownMenuItem>}
                    <DropdownMenuItem className="focus:bg-zinc-700" onClick={() => onForward(message)}><Forward className="mr-2 h-4 w-4"/> Transférer</DropdownMenuItem>
                    {isSentByCurrentUser && <DropdownMenuItem className="focus:bg-zinc-700" onClick={() => onDeleteMessage(message.id)}><Trash2 className="mr-2 h-4 w-4"/> {t('deleteButton')}</DropdownMenuItem>}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

      <div className={cn(
        "rounded-lg shadow-sm relative", 
        isSentByCurrentUser 
          ? "bg-[#005c4b] text-white rounded-br-none" 
          : "bg-[#2a3942] text-white rounded-bl-none",
        isProduct ? "p-1" : "p-2 min-w-[100px] max-w-[75%]",
        (isImage || isAudio) && "p-1",
        transferData && "bg-zinc-800 border border-zinc-700"
      )}>
        {isProduct ? (
            <ProductCardMessage metadata={message.metadata!} />
        ) : isDocument && fileData?.fileUrl ? (
            <a href={fileData.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/20 rounded-md p-2">
                <FileText className="h-8 w-8 text-white"/>
                <div className="flex-1">
                    <p className="font-semibold text-sm line-clamp-1">{fileData.fileName}</p>
                    <p className="text-xs text-zinc-300">{t('documentLabel')}</p>
                </div>
            </a>
        ) : isImage && fileData?.fileUrl ? (
             <div className="flex flex-col gap-1">
                <div className="relative group/img cursor-pointer" onClick={() => onImageClick(fileData!.fileUrl)}>
                    <img src={fileData.fileUrl} alt="Image envoyée" width={250} height={250} loading="lazy" className="rounded-md object-cover max-w-full h-auto" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                        <Maximize2 className="h-8 w-8 text-white/80" />
                    </div>
                </div>
                <div className="flex justify-around items-center py-1 border-t border-white/10 mt-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={() => {}}><ThumbsUp className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={handleDownload}><Download className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={() => onForward(message)}><Forward className="h-4 w-4"/></Button>
                </div>
            </div>
        ) : isAudio ? (
             <VoiceMessagePlayer message={message} senderAvatar={sender?.profile_photo || undefined} />
        ) : transferData ? (
             <p className="whitespace-pre-wrap text-sm p-2 italic">{transferData.text}</p>
        ) : (
            <p className="whitespace-pre-wrap break-words text-sm p-2">
              {String(message.content ?? '').split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                /^https?:\/\//.test(part)
                  ? <a key={i} href={part} className="underline text-sky-300 break-all">{part}</a>
                  : <React.Fragment key={i}>{part}</React.Fragment>
              )}
            </p>
        )}
        <div className="flex items-center justify-end gap-1.5 text-xs text-green-300/60 mt-1 self-end px-1.5 pb-1">
          <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
          <MessageStatus />
        </div>
      </div>
    </div>
  );
};

const DateSeparator = ({ date }: { date: string }) => {
    const { t } = useTranslation();
    const messageDate = parseISO(date);
    let formattedDate;

    if (isToday(messageDate)) {
        formattedDate = t('today');
    } else if (isYesterday(messageDate)) {
        formattedDate = t('yesterday');
    } else if (isThisYear(messageDate)) {
        formattedDate = format(messageDate, 'EEEE d MMMM', { locale: fr });
    } else {
        formattedDate = format(messageDate, 'd MMMM yyyy', { locale: fr });
    }

    return (
        <div className="flex justify-center my-4">
            <div className="px-3 py-1 text-xs text-white bg-[#1f2c33] rounded-full shadow-md">
                {formattedDate}
            </div>
        </div>
    );
};

const ChatHeader = ({ onBack, contact, onViewProfile, onStartCall }: { onBack: () => void, contact: User, onViewProfile: () => void, onStartCall: (type: 'audio' | 'video' | 'meeting') => void }) => {
    const shortcuts = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/shopping", label: "Shopping", icon: ShoppingCart },
        { href: "/casino", label: "Casino", icon: Gamepad2 },
        { href: "/cinema", label: "Cinema", icon: Clapperboard },
        { href: "/monpays", label: "MonPays", icon: Map },
        { href: "/b2b", label: "B2B", icon: Briefcase },
    ];
    
    return (
        <header className="flex items-center p-2 sm:p-3 border-b border-zinc-700/50 shrink-0 bg-[#1f2c33] text-white">
            <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
                <ArrowLeft />
            </Button>
            <div className="flex items-center gap-3 ml-2 cursor-pointer flex-1 min-w-0" onClick={onViewProfile}>
              <div className="relative">
                 <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                      <AvatarImage src={contact.profile_photo || ''} alt={contact.full_name} data-ai-hint="person portrait" />
                      <AvatarFallback>{contact.first_name?.[0]}</AvatarFallback>
                  </Avatar>
                  {contact.availabilityStatus === 'available' && <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-[#1f2c33]" />}
              </div>
              <div className="min-w-0">
                  <h2 className="font-bold text-base truncate">{contact.full_name}</h2>
                  <p className="text-xs text-zinc-400">{contact.availabilityStatus === 'available' ? 'En ligne' : 'Hors ligne'}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1">
                 <Button variant="ghost" size="icon" onClick={() => onStartCall('video')}><Video /></Button>
                <Button variant="ghost" size="icon" onClick={() => onStartCall('audio')}><Phone /></Button>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-zinc-800 border-zinc-700 text-white">
                         <DropdownMenuItem className="focus:bg-zinc-700" onClick={() => onStartCall('meeting')}>
                            <UsersIcon className="mr-2 h-4 w-4"/> Démarrer une réunion
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-700"/>
                        {shortcuts.map(shortcut => (
                            <DropdownMenuItem key={shortcut.href} asChild className="focus:bg-zinc-700">
                                <Link href={shortcut.href}><shortcut.icon className="mr-2 h-4 w-4"/>{shortcut.label}</Link>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}

const magicBucketFilters = [
    { name: 'Original', filter: 'none' },
    { name: 'Clarté', filter: 'brightness(1.1) contrast(1.1) saturate(1.1)' },
    { name: 'Vibrant', filter: 'saturate(1.8)' },
    { name: 'Chaud', filter: 'sepia(0.3) saturate(1.4) brightness(1.1)' },
    { name: 'Froid', filter: 'hue-rotate(180deg) saturate(1.2) brightness(1.1)' },
    { name: 'Noir & Blanc', filter: 'grayscale(1)' },
    { name: 'Sépia', filter: 'sepia(1)' },
    { name: 'Doux', filter: 'blur(0.5px) brightness(1.05)' },
    { name: 'Magic', filter: 'hue-rotate(45deg) contrast(1.1) saturate(1.2)' },
];

const ImageEditor = ({ imageData, onCancel, onSend }: { imageData: string, onCancel: () => void, onSend: (finalData: string) => void }) => {
    const [selectedFilter, setSelectedFilter] = useState(magicBucketFilters[0]);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleSend = () => {
        const img = new (window as any).Image();
        img.src = imageData;
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = img.width;
            canvas.height = img.height;

            ctx.filter = selectedFilter.filter;
            ctx.drawImage(img, 0, 0);
            
            const finalData = canvas.toDataURL('image/jpeg', 0.8);
            onSend(finalData);
        };
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col text-white">
            <header className="p-4 flex items-center justify-between bg-zinc-900/50">
                <Button variant="ghost" size="icon" onClick={onCancel}><X /></Button>
                <h3 className="font-bold flex items-center gap-2 text-primary"><Wand className="h-5 w-5"/> Baket Magic</h3>
                <Button variant="ghost" size="icon" className="text-green-500" onClick={handleSend}><CheckCircle2 /></Button>
            </header>
            
            <div className="flex-1 relative flex items-center justify-center p-4">
                <canvas ref={canvasRef} className="hidden" />
                <div className="relative max-w-full max-h-full transition-all duration-300" style={{ filter: selectedFilter.filter }}>
                    <img src={imageData} alt="pending" className="max-w-full max-h-[70vh] object-contain rounded-md shadow-2xl" />
                </div>
            </div>

            <div className="p-4 bg-zinc-900/80 border-t border-zinc-800">
                <p className="text-xs text-center text-zinc-400 mb-4 uppercase tracking-widest font-semibold">Choisissez un effet</p>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-2">
                    {magicBucketFilters.map(f => (
                        <button 
                            key={f.name}
                            onClick={() => setSelectedFilter(f)}
                            className="flex flex-col items-center gap-2 shrink-0 group"
                        >
                            <div className={cn(
                                "h-20 w-20 rounded-lg bg-zinc-800 border-2 overflow-hidden transition-all relative",
                                selectedFilter.name === f.name ? "border-primary scale-110 shadow-[0_0_15px_rgba(255,102,0,0.4)]" : "border-transparent"
                            )}>
                                <img src={imageData} alt={f.name} className="h-full w-full object-cover" style={{ filter: f.filter }} />
                                {selectedFilter.name === f.name && (
                                    <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                        <Check className="h-6 w-6 text-white" />
                                    </div>
                                )}
                            </div>
                            <span className={cn("text-[10px] font-medium", selectedFilter.name === f.name ? "text-primary" : "text-zinc-400")}>{f.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};


interface ChatViewProps {
    conversation: Conversation;
    currentUser: User;
    onBack: () => void;
    onUpdateConversation: (conversation: Conversation) => void;
    onViewProfile: (contact: User) => void;
    onStartCall: (contact: User, type: 'audio' | 'video' | 'meeting') => void;
    onDeleteMessage: (messageId: string) => void;
}

export function ChatView({ conversation, currentUser, onBack, onUpdateConversation, onViewProfile, onStartCall, onDeleteMessage }: ChatViewProps) {
  const { t } = useTranslation();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [assistantSettings, setAssistantSettings] = useState<AssistantSettings | null>(null);
  const [isUserOverride, setIsUserOverride] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userCurrencies, setUserCurrencies] = useState<Currency[]>([]);
  
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState('');
  
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);

  const { toast } = useToast();
  const { openAlert } = useAlertDialog();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchCurrencies = async () => {
        const currencies = await getUserCurrencies(currentUser.id);
        setUserCurrencies(currencies);
    }
    fetchCurrencies();
  }, [currentUser.id]);

  useEffect(() => {
    setIsUserOverride(false);
    const savedSettingsRaw = localStorage.getItem('cashpay-user-profile');
    if (savedSettingsRaw) {
        const userProfile: User = JSON.parse(savedSettingsRaw);
        setAssistantSettings(userProfile.assistantSettings || null);
    }
  }, [conversation]);
  
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages, scrollToBottom]);

  // Réception des nouveaux messages (même route que l'application mobile).
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  const sendingRef = useRef(false);
  sendingRef.current = isSending;
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden || sendingRef.current) return;
      const fresh = await fetchChatMessages(conversationRef.current.id);
      if (stopped || !fresh || sendingRef.current) return;
      const current = conversationRef.current.messages.filter(m => !String(m.id).startsWith('temp-'));
      const lastFresh = fresh[fresh.length - 1];
      const lastCurrent = current[current.length - 1];
      if (fresh.length !== current.length || (lastFresh && lastCurrent && lastFresh.id !== lastCurrent.id)) {
        const last = fresh[fresh.length - 1];
        onUpdateConversation({
          ...conversationRef.current,
          messages: fresh,
          lastMessage: last?.content ?? conversationRef.current.lastMessage,
          lastMessageTimestamp: last?.timestamp ?? conversationRef.current.lastMessageTimestamp,
        });
        if (lastFresh && Number(lastFresh.senderId) !== Number(currentUser.id)) {
          markConversationAsRead(conversationRef.current.id, currentUser.id).catch(() => undefined);
        }
      }
    };
    const timer = setInterval(tick, 3000);
    return () => { stopped = true; clearInterval(timer); };
  }, [conversation.id, currentUser.id, onUpdateConversation]);

  const handleCall = (type: 'audio' | 'video' | 'meeting') => {
      onStartCall(conversation.contact, type);
  };
  
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (assistantSettings?.isEnabled && !isUserOverride) {
      setIsUserOverride(true);
    }
  };
  
  const handleInChatTransfer = async (values: z.infer<typeof transferSchema>) => {
    setIsSending(true);

    const result = await createInChatTransfer({
      conversationId: conversation.id,
      senderId: currentUser.id,
      receiverId: conversation.contact.id,
      amount: values.amount,
      currency: values.currency,
      pin: values.pin
    });

    if (result.success && result.conversation) {
      onUpdateConversation(result.conversation);
      toast({ variant: 'success', title: 'Transfert Envoyé', description: `Vous avez envoyé ${values.amount} ${values.currency} à ${conversation.contact.full_name}.` });
    } else {
      openAlert({ variant: "error", title: t('transferErrorTitle'), description: result.error });
    }
    
    setIsSending(false);
    setIsTransferDialogOpen(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        
        if (file.type.startsWith('image')) {
            setPendingImage(dataUrl);
            setPendingFileName(file.name);
        } else {
            const fileType = 'doc';
            await handleSendMessage(file.name, fileType, dataUrl, file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendEditedImage = async (finalData: string) => {
      setPendingImage(null);
      await handleSendMessage(pendingFileName, 'image', finalData, pendingFileName);
  };


  const handleSendMessage = useCallback(async (content: string, type: Message['type'] = 'text', fileDataUri?: string, fileName?: string) => {
    if (!content.trim() && !fileDataUri) return;

    setIsSending(true);
    setNewMessage("");

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      senderId: currentUser.id,
      content: content,
      type: type,
      timestamp: new Date().toISOString(),
      status: 'sent',
    };

    const nextConversationState: Conversation = {
      ...conversation,
      messages: [...conversation.messages, tempMessage],
      lastMessage: type === 'audio' ? "🎤 Message vocal" : type === 'doc' ? "📄 Document" : type === 'image' ? '📷 Photo' : content,
      lastMessageTimestamp: tempMessage.timestamp,
    };
    onUpdateConversation(nextConversationState);
    
    try {
        const sentMessageData = await sendChatMessage(conversation.id, { content, type, fileDataUri, fileName });
        const finalConversation = {
          ...nextConversationState,
          messages: nextConversationState.messages.map((msg) =>
            msg.id === tempId ? { ...sentMessageData, senderId: currentUser.id } : msg
          ),
        };
        onUpdateConversation(finalConversation);
    } catch (error: any) {
        // L'envoi a échoué : on retire le message provisoire et on prévient l'utilisateur.
        onUpdateConversation({ ...conversation, messages: conversation.messages });
        if (type === 'text') setNewMessage(content);
        toast({ variant: 'destructive', title: "Message non envoyé", description: error?.message || "Vérifiez votre connexion et réessayez." });
    }
    
    setIsSending(false);
  }, [conversation, currentUser, onUpdateConversation]);

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
            .find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m));
        mediaRecorderRef.current = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };
        
        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: (mediaRecorderRef.current?.mimeType || 'audio/webm').split(';')[0] });
            if (audioBlob.size === 0) { stream.getTracks().forEach(track => track.stop()); return; }
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                await handleSendMessage('Message vocal', 'audio', base64data);
            };
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
    } catch (err) {
        console.error("Error starting recording:", err);
        toast({ variant: 'destructive', title: t('micAccessDeniedTitle'), description: t('micAccessDeniedDescription') });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };
  
  const handleMicClick = () => {
      isRecording ? stopRecording() : startRecording();
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
          toast({ title: 'Message transféré', variant: 'success' });
      } else {
          openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
      }
  }

  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0b141a]">
      <ChatHeader onBack={onBack} contact={conversation.contact} onViewProfile={() => onViewProfile(conversation.contact)} onStartCall={handleCall}/>
      
      {pendingImage && (
          <ImageEditor imageData={pendingImage} onCancel={() => setPendingImage(null)} onSend={handleSendEditedImage} />
      )}

      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 bg-transparent border-none shadow-none flex items-center justify-center">
              <div className="relative w-full h-full flex items-center justify-center">
                  <DialogTitle className="sr-only">Aperçu de l'image</DialogTitle>
                  {lightboxUrl && <img src={lightboxUrl} alt="Aperçu" className="max-w-full max-h-[85vh] object-contain rounded-lg" />}
                  <Button variant="ghost" size="icon" className="absolute -top-10 right-0 text-white" onClick={() => setLightboxUrl(null)}><X /></Button>
              </div>
          </DialogContent>
      </Dialog>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf,.doc,.docx" />

      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>{t('sendMoneyTo', { name: conversation.contact.first_name })}</DialogTitle>
                  <DialogDescription>{t('transferIsSecure')}</DialogDescription>
              </DialogHeader>
              <InChatTransferForm onSubmit={handleInChatTransfer} currencies={userCurrencies} currentUser={currentUser}/>
          </DialogContent>
      </Dialog>

      <Dialog open={isForwardDialogOpen} onOpenChange={setIsForwardDialogOpen}>
          <DialogContent className="p-0">
              <DialogHeader className="p-4 border-b">
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
      
      <ScrollArea
      className="flex-1 min-h-0"
      viewportRef={scrollAreaRef}
    >
          <div className="p-4 space-y-2">
          {conversation.messages.map((message, index) => {
                  const prevMessage = conversation.messages[index - 1];
                  const showDateSeparator = !prevMessage || format(new Date(prevMessage.timestamp), 'yyyy-MM-dd') !== format(new Date(message.timestamp), 'yyyy-MM-dd');
                  const normalizedSenderId = Number(message.senderId);
const normalizedCurrentUserId = Number(currentUser.id);

const isCurrentUserMessage =
  normalizedSenderId === normalizedCurrentUserId;

const sender = isCurrentUserMessage
  ? currentUser
  : conversation.contact;
                  return (
                      <React.Fragment key={`${message.id}-${index}`}>
                          {showDateSeparator && <DateSeparator date={message.timestamp} />}
                          <MessageBubble 
                            message={message} 
                            currentUser={currentUser} 
                            sender={sender} 
                            onDeleteMessage={onDeleteMessage} 
                            onForward={openForwardDialog}
                            onImageClick={setLightboxUrl}
                          />
                      </React.Fragment>
                  );
              })}
          </div>
      </ScrollArea>
      
      <footer className="shrink-0 border-t border-zinc-700/50 bg-[#1f2c33] p-2">
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
                <DropdownMenuItem className="focus:bg-zinc-700" onClick={() => setIsTransferDialogOpen(true)}><Banknote className="mr-2 h-4 w-4"/> {t('sendMoneyMenuItem')}</DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-zinc-700" onClick={() => fileInputRef.current?.click()}><Paperclip className="mr-2 h-4 w-4"/> {t('documentMenuItem')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Input
            placeholder={t('messagePlaceholder')}
            value={newMessage}
            onChange={handleTyping}
            onKeyPress={(e) => e.key === 'Enter' && !isSending && handleSendMessage(newMessage)}
            className="bg-[#2a3942] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-11 rounded-lg px-4 text-white placeholder:text-zinc-400"
            disabled={isRecording}
          />
          {newMessage.trim() ? (
            <Button size="icon" className="rounded-full bg-primary hover:bg-primary/90 h-11 w-11" onClick={() => handleSendMessage(newMessage)} disabled={isSending}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send />}
            </Button>
          ) : (
            <Button size="icon" className={cn("rounded-full bg-primary hover:bg-primary/90 h-11 w-11", isRecording && "bg-red-500 hover:bg-red-600")} onClick={handleMicClick}>
                {isRecording ? <StopCircle /> : <Mic />}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
