'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Share2,
  ThumbsUp,
  BadgeCheck,
  Rocket,
  MessageSquare,
  Loader2,
  Send,
  ArrowLeft
} from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { formatKiloMega, cn } from '@/lib/utils';
import { BoostDialog } from '@/components/monpays/boost-dialog';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MonPaysActivity, MonPaysCompany, User } from '@/lib/types';
import { likeActivity, shareActivity, postMonPaysComment, getMonPaysComments } from '@/lib/actions/monpays.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Textarea } from '../ui/textarea';
import { useRouter } from 'next/navigation';

export function PlatformDetailClient({ activity, company }: { activity: MonPaysActivity, company: MonPaysCompany }) {
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  const [likes, setLikes] = useState(activity.likes);
  const [shares, setShares] = useState(activity.shares);
  const [isLiking, setIsLiking] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getAuthenticatedUser().then(setUser);
    getMonPaysComments(parseInt(activity.id)).then(setComments);
  }, [activity.id]);

  const handleLike = async () => {
    if (!user) {
        openAlert({ title: "Connexion requise", description: "Veuillez vous connecter pour aimer cette publication.", variant: 'info' });
        return;
    }
    setIsLiking(true);
    const result = await likeActivity(activity.id, user.id);
    if (result.success) {
        setLikes(result.likes!);
    }
    setIsLiking(false);
  };

  const handleShare = async () => {
    if (!user) {
        openAlert({ title: "Connexion requise", description: "Veuillez vous connecter pour partager cette publication.", variant: 'info' });
        return;
    }

    setIsSharing(true);
    const result = await shareActivity(activity.id, user.id);
    setIsSharing(false);

    if (result.success) {
        setShares(prev => prev + 1);
        openAlert({
            variant: result.reward ? 'success' : 'info',
            title: result.reward ? 'Partage rémunéré !' : 'Partagé !',
            description: result.message,
        });
    }
  };

  const handlePostComment = async () => {
      if (!user || !newComment.trim()) return;
      setIsPosting(true);
      const result = await postMonPaysComment(parseInt(activity.id), user.id, newComment);
      if (result.success) {
          setNewComment('');
          const updatedComments = await getMonPaysComments(parseInt(activity.id));
          setComments(updatedComments);
      }
      setIsPosting(false);
  };

  return (
    <div className="bg-zinc-900 min-h-screen text-white flex flex-col">
      <header className="sticky top-0 z-20 bg-zinc-800/90 backdrop-blur-md p-2 flex items-center gap-2 border-b border-zinc-700">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <h2 className="font-bold truncate">Détail de la publication</h2>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto pb-32">
            <div className="p-4">
                <Link href={`/monpays/company/${company.id}`} className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-zinc-700">
                    <AvatarImage src={company.logoUrl} alt={company.name} />
                    <AvatarFallback>{company.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                    <div className="flex items-center gap-1">
                        <p className="font-bold text-white hover:underline">{company.name}</p>
                        {company.isVerified && <BadgeCheck className="h-5 w-5 text-blue-500" />}
                    </div>
                    <p className="text-xs text-zinc-400">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: fr })}</p>
                </div>
                </Link>
                <p className="my-4 text-zinc-200 text-base leading-relaxed">{activity.description}</p>
            </div>
            
            {activity.imageUrl && (
                <div className="relative aspect-video bg-zinc-800">
                    <Image src={activity.imageUrl} alt={activity.title} fill className="object-cover" />
                </div>
            )}

            <div className="p-4">
                <div className="flex justify-between items-center text-zinc-400 text-xs mb-4">
                    <span>{formatKiloMega(likes)} likes</span>
                    <span>{formatKiloMega(shares)} partages</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 border-y border-zinc-800 py-1">
                    <Button variant="ghost" className="text-zinc-300 h-10" onClick={handleLike} disabled={isLiking}>
                        {isLiking ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <ThumbsUp className="h-4 w-4 mr-2"/>} J'aime
                    </Button>
                    <Button variant="ghost" className="text-zinc-300 h-10" onClick={handleShare} disabled={isSharing}>
                        {isSharing ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Share2 className="h-4 w-4 mr-2"/>} Partager
                    </Button>
                    <BoostDialog activity={activity} company={company}>
                        <Button variant="ghost" className="text-yellow-500 h-10">
                            <Rocket className="h-4 w-4 mr-2"/> Booster
                        </Button>
                    </BoostDialog>
                </div>

                <div className="mt-6 space-y-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5"/> Commentaires ({comments.length})
                    </h3>
                    
                    {user ? (
                        <div className="flex gap-2 items-start">
                            <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={user.profile_photo || ''}/></Avatar>
                            <div className="flex-1 flex flex-col gap-2">
                                <Textarea 
                                    placeholder="Ajouter un commentaire..." 
                                    className="bg-zinc-800 border-zinc-700 min-h-[80px]"
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                />
                                <Button size="sm" className="self-end bg-primary" onClick={handlePostComment} disabled={isPosting || !newComment.trim()}>
                                    {isPosting ? <Loader2 className="h-3 w-3 animate-spin mr-2"/> : <Send className="h-3 w-3 mr-2"/>} Publier
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-zinc-500 italic">Veuillez vous connecter pour commenter.</p>
                    )}

                    <div className="space-y-4">
                        {comments.map(comment => (
                            <div key={comment.id} className="flex gap-3">
                                <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarImage src={comment.userPhoto || ''} />
                                    <AvatarFallback>{comment.userName[0]}</AvatarFallback>
                                </Avatar>
                                <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none flex-1">
                                    <p className="font-bold text-xs text-primary mb-1">{comment.userName}</p>
                                    <p className="text-sm text-zinc-200">{comment.content}</p>
                                    <p className="text-[10px] text-zinc-500 mt-2">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
