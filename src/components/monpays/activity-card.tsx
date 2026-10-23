'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ThumbsUp, MessageSquare, Share2, BadgeCheck, Loader2, Coins, X, Facebook, Linkedin, Instagram } from 'lucide-react';
import type { MonPaysActivity, MonPaysCompany } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatKiloMega, cn } from '@/lib/utils';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Separator } from '../ui/separator';
import { likeActivity, initiateTrackedShare } from '@/lib/actions/monpays.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

const TwitterIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
    </svg>
);

export function ActivityCard({ activity, company }: { activity: MonPaysActivity, company: MonPaysCompany }) {
  const { openAlert } = useAlertDialog();
  const [likes, setLikes] = useState(activity.likes);
  const [shares, setShares] = useState(activity.shares);
  const [isLiking, setIsLiking] = useState(false);
  const [isSharingOpen, setIsSharingOpen] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const handleLike = async () => {
    const user = await getAuthenticatedUser();
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

  const handleSocialShare = async (platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram') => {
    const user = await getAuthenticatedUser();
    if (!user) {
        openAlert({ title: "Connexion requise", description: "Veuillez vous connecter pour partager cette publication.", variant: 'info' });
        return;
    }

    setIsGeneratingLink(true);
    const result = await initiateTrackedShare(activity.id, user.id, platform);
    setIsGeneratingLink(false);

    if (result.success && result.shareUrl) {
        const text = encodeURIComponent(`Découvrez cette publication sur MonPays : ${activity.description.substring(0, 100)}...`);
        const url = encodeURIComponent(result.shareUrl);
        
        let finalUrl = '';
        switch(platform) {
            case 'facebook': finalUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`; break;
            case 'twitter': finalUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`; break;
            case 'linkedin': finalUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`; break;
            case 'instagram': 
                navigator.clipboard.writeText(result.shareUrl);
                openAlert({ title: "Instagram", description: "Le lien a été copié. Collez-le dans votre Story ou votre Bio !", variant: 'info' });
                setIsSharingOpen(false);
                return;
        }
        
        window.open(finalUrl, '_blank', 'width=600,height=400');
        setIsSharingOpen(false);
        setShares(prev => prev + 1);
        
        if (activity.isMonetized) {
            openAlert({ 
                title: "Partage enregistré", 
                description: "Votre lien de partage unique a été généré. Obtenez 5 clics uniques sur ce lien pour recevoir automatiquement votre récompense !",
                variant: 'success'
            });
        }
    } else {
        openAlert({ title: "Erreur", description: result.error || "Échec de la génération du lien.", variant: 'error' });
    }
  };


  return (
    <>
    <Dialog open={isSharingOpen} onOpenChange={setIsSharingOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-xs">
            <DialogHeader>
                <DialogTitle>Partager sur</DialogTitle>
                <DialogDescription className="text-zinc-400">
                    Gagnez des récompenses en partageant sur vos réseaux.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
                <Button variant="outline" className="bg-blue-600 border-none hover:bg-blue-700 flex flex-col h-20 gap-2" onClick={() => handleSocialShare('facebook')} disabled={isGeneratingLink}>
                    <Facebook className="h-6 w-6"/>
                    <span className="text-xs">Facebook</span>
                </Button>
                <Button variant="outline" className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 flex flex-col h-20 gap-2" onClick={() => handleSocialShare('twitter')} disabled={isGeneratingLink}>
                    <TwitterIcon />
                    <span className="text-xs">Twitter</span>
                </Button>
                <Button variant="outline" className="bg-pink-600 border-none hover:bg-pink-700 flex flex-col h-20 gap-2" onClick={() => handleSocialShare('instagram')} disabled={isGeneratingLink}>
                    <Instagram className="h-6 w-6"/>
                    <span className="text-xs">Instagram</span>
                </Button>
                <Button variant="outline" className="bg-blue-800 border-none hover:bg-blue-900 flex flex-col h-20 gap-2" onClick={() => handleSocialShare('linkedin')} disabled={isGeneratingLink}>
                    <Linkedin className="h-6 w-6"/>
                    <span className="text-xs">LinkedIn</span>
                </Button>
            </div>
            {isGeneratingLink && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
        </DialogContent>
    </Dialog>

    <div className="bg-zinc-800 text-white border border-zinc-700/50 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4">
            <div className="flex justify-between items-start">
                <Link href={`/monpays/company/${company.id}`} className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-11 w-11 border-2 border-zinc-700">
                            <AvatarImage src={company.logoUrl} alt={company.name} />
                            <AvatarFallback>{company.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        {company.isVerified && (
                            <div className="absolute -bottom-1 -right-1 bg-zinc-800 rounded-full p-0.5">
                                <Image src="/images/badge/celebre.png" alt="Certifié" width={14} height={14} />
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm hover:underline">{company.name}</p>
                            <BadgeCheck className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                        </div>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-tighter">{company.category} • {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: fr })}</p>
                    </div>
                </Link>
                <div className="flex items-center gap-2">
                    {activity.isMonetized && activity.monetizationBudget > 0 && (
                        <div className="bg-yellow-500/10 text-yellow-500 text-[10px] font-bold px-2 py-1 rounded-md border border-yellow-500/20 flex items-center gap-1.5">
                            <Coins className="h-3 w-3" />
                            +{activity.rewardPerShare} CDF / 5 CLICS
                        </div>
                    )}
                </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-200">{activity.description}</p>
        </div>

        {activity.imageUrl ? (
        <Link href={`/monpays/platform/${activity.id}`}>
          <div className="relative aspect-video bg-zinc-900 group cursor-pointer">
            <Image
              src={activity.imageUrl}
              alt={activity.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              data-ai-hint="advertisement product"
            />
            {activity.isMonetized && activity.monetizationBudget > 0 && (
                <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg flex items-center gap-1.5 animate-pulse">
                    <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
                    SPONSORISÉ
                </div>
            )}
          </div>
        </Link>
        
        ) : (
          <Link href={`/monpays/platform/${activity.id}`} className="block h-1" aria-label="Voir la publication" />
        )}

        <div className="px-4 py-2 bg-zinc-800/50">
            <div className="flex justify-between items-center text-zinc-400 text-[10px] mb-2">
                <div className="flex items-center gap-1">
                    <div className="flex -space-x-1">
                        <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center border border-zinc-800">
                            <ThumbsUp className="h-2 w-2 text-white fill-white"/>
                        </div>
                    </div>
                    <span>{formatKiloMega(likes)}</span>
                </div>
                <span>{formatKiloMega(shares)} partages</span>
            </div>
            <Separator className="bg-zinc-700/50"/>
            <div className="grid grid-cols-3 gap-1 pt-1">
                <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-700 h-9 text-xs" onClick={handleLike} disabled={isLiking}>
                    {isLiking ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <ThumbsUp className="h-4 w-4 mr-2"/>} J'aime
                </Button>
                <Button asChild variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-700 h-9 text-xs">
                    <Link href={`/feedback?contactId=${company.ownerUserId ?? ''}`} onClick={(e) => e.stopPropagation()}>
                        <MessageSquare className="h-4 w-4 mr-2"/> Chat
                    </Link>
                </Button>
                 <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-700 h-9 text-xs" onClick={() => setIsSharingOpen(true)}>
                    <Share2 className="h-4 w-4 mr-2"/> Partager
                </Button>
            </div>
        </div>
    </div>
    </>
  );
}
