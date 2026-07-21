
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { X, Mic, MicOff, Video, VideoOff, ScreenShare, RefreshCw, Send, Gift, Users, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatKiloMega } from '@/lib/utils';
import type { User } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';

// --- Mock Data and Types ---
interface LiveComment {
    id: number;
    user: { name: string; avatar: string; };
    text: string;
}
interface JoinRequest {
    id: number;
    user: { name: string; avatar: string; };
    price: number;
}
const MOCK_COMMENTS: LiveComment[] = [
    { id: 1, user: { name: 'John Doe', avatar: '/avatars/contact-1.png'}, text: 'Super live !' },
    { id: 2, user: { name: 'Jane Smith', avatar: '/avatars/contact-2.png'}, text: 'Salut de Paris !' },
    { id: 3, user: { name: 'Mike', avatar: '/avatars/contact-3.png'}, text: 'Quel est le sujet ? 🤔' },
];

const Comment = ({ comment }: { comment: LiveComment }) => (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-black/10 backdrop-blur-sm">
        <Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatar} /><AvatarFallback>{comment.user.name[0]}</AvatarFallback></Avatar>
        <div>
            <p className="text-xs text-zinc-400">{comment.user.name}</p>
            <p className="text-sm text-white">{comment.text}</p>
        </div>
    </div>
);

// --- Main Component ---
export function LiveStreamView({ user, onExit }: { user: User | null, onExit: () => void }) {
    const { toast } = useToast();
    const [isLive, setIsLive] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [comments, setComments] = useState<LiveComment[]>([]);
    const [joinRequest, setJoinRequest] = useState<JoinRequest | null>(null);

    useEffect(() => {
        const getCameraPermission = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
            } catch (error) {
                console.error('Error accessing camera:', error);
                setHasCameraPermission(false);
            }
        };
        getCameraPermission();
    }, [facingMode]);
    
    // Simulate live comments
    useEffect(() => {
        if (isLive) {
            const commentInterval = setInterval(() => {
                const newComment = MOCK_COMMENTS[Math.floor(Math.random() * MOCK_COMMENTS.length)];
                setComments(prev => [...prev.slice(-5), { ...newComment, id: Date.now() }]);
            }, 3000);

            // Simulate a join request
            setTimeout(() => {
                setJoinRequest({ id: 1, user: { name: 'Alex', avatar: '/avatars/contact-4.png' }, price: 1 });
            }, 10000);
            
            return () => clearInterval(commentInterval);
        }
    }, [isLive]);

    const handleFlipCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    const handleJoinRequest = (accept: boolean) => {
        if (accept) {
            toast({ title: 'Invitation envoyée', description: `Alex a été invité à rejoindre votre live.` });
        }
        setJoinRequest(null);
    };

    const Header = () => (
         <div className="absolute top-0 left-0 right-0 z-20 h-16 flex items-center justify-between px-4 bg-gradient-to-b from-black/50 to-transparent">
            <div className="flex items-center gap-2 bg-black/30 p-2 rounded-lg">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profile_photo || undefined} />
                    <AvatarFallback>{user?.first_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-bold">{user?.full_name}</p>
                    <p className="text-xs text-zinc-300">{formatKiloMega(12500)} abonnés</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-black/30 p-2 rounded-lg">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-bold">{formatKiloMega(8300)}</span>
                </div>
                {isLive && <div className="bg-red-500 px-2 py-1 text-xs font-bold rounded-md animate-pulse">LIVE</div>}
                <Button variant="ghost" size="icon" onClick={onExit} className="bg-black/30"><X /></Button>
            </div>
        </div>
    );
    
    const FooterControls = () => (
         <div className="absolute bottom-0 left-0 right-0 z-20 h-20 flex items-center justify-between px-4 bg-gradient-to-t from-black/50 to-transparent">
            <div className="flex items-center bg-black/30 rounded-full h-12 p-1 gap-1">
                <Input placeholder="Ajouter un commentaire..." className="bg-transparent border-none h-full focus-visible:ring-0 text-white" />
                <Button variant="ghost" size="icon" className="rounded-full"><Send /></Button>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="bg-black/30 rounded-full h-12 w-12"><Gift /></Button>
                <Button variant="ghost" size="icon" className="bg-black/30 rounded-full h-12 w-12" onClick={() => setIsMuted(!isMuted)}>
                    {isMuted ? <MicOff /> : <Mic />}
                </Button>
                <Button variant="ghost" size="icon" className="bg-black/30 rounded-full h-12 w-12" onClick={handleFlipCamera}><RefreshCw /></Button>
            </div>
        </div>
    );

    return (
        <div className="absolute inset-0 bg-black text-white z-50">
            <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
            <Header />

            {!isLive && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
                    <div className="text-center">
                        {hasCameraPermission === false ? (
                             <Alert variant="destructive" className="max-w-sm mx-auto">
                                <AlertTitle>Accès Caméra Requis</AlertTitle>
                                <AlertDescription>Veuillez autoriser l'accès à la caméra et au micro dans les paramètres de votre navigateur pour démarrer un live.</AlertDescription>
                            </Alert>
                        ) : (
                             <Button size="lg" className="bg-red-600 hover:bg-red-700 h-14 text-lg" onClick={() => setIsLive(true)}>
                                Démarrer le direct
                            </Button>
                        )}
                    </div>
                </div>
            )}
            
            {isLive && (
                <>
                 <div className="absolute top-20 left-4 z-10 max-h-[40%] overflow-hidden">
                    <div className="flex flex-col gap-2">
                        {comments.map(c => <Comment key={c.id} comment={c} />)}
                    </div>
                 </div>

                 <div className="absolute bottom-24 right-4 z-10 flex flex-col items-center gap-3">
                     <Button variant="ghost" size="icon" className="h-12 w-12 flex-col bg-black/30 rounded-full gap-1">
                         <Heart className="h-6 w-6"/>
                         <span className="text-xs">{formatKiloMega(12800)}</span>
                     </Button>
                     <Button variant="ghost" size="icon" className="h-12 w-12 bg-black/30 rounded-full"><Users /></Button>
                     <Button variant="ghost" size="icon" className="h-12 w-12 bg-black/30 rounded-full"><ScreenShare /></Button>
                 </div>

                 {joinRequest && (
                      <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-background/80 backdrop-blur-md w-80">
                         <CardContent className="p-4 flex flex-col items-center text-center">
                             <Avatar className="h-16 w-16 mb-2"><AvatarImage src={joinRequest.user.avatar} /><AvatarFallback>{joinRequest.user.name[0]}</AvatarFallback></Avatar>
                             <p><span className="font-bold">{joinRequest.user.name}</span> souhaite rejoindre votre live.</p>
                             <p className="text-sm text-muted-foreground">Frais de participation: <span className="font-bold text-foreground">${joinRequest.price.toFixed(2)}</span></p>
                             <div className="flex gap-4 mt-4 w-full">
                                 <Button variant="destructive" className="flex-1" onClick={() => handleJoinRequest(false)}>Refuser</Button>
                                 <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleJoinRequest(true)}>Accepter</Button>
                             </div>
                         </CardContent>
                      </Card>
                 )}

                 <FooterControls />
                </>
            )}
        </div>
    );
}
