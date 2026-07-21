
'use client';

import { useState, useRef, useEffect } from 'react';
import type { JojoVideo, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Send, Music, Play, Plus, Bookmark, Share2, Tv, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKiloMega } from '@/lib/utils';
import Image from 'next/image';
import { LiveStreamView } from './live-stream-view';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

const JojoHeader = ({ onGoLiveClick }: { onGoLiveClick: () => void }) => {
    const [activeTab, setActiveTab] = useState('Pour toi');
    return (
        <header className="absolute top-0 left-0 right-0 z-20 h-16 flex items-center justify-between px-4 bg-gradient-to-b from-black/50 to-transparent">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={onGoLiveClick}>
                <Tv />
            </Button>

            <div className="flex items-center gap-6 text-lg font-bold text-zinc-400">
                <button 
                    onClick={() => setActiveTab('Suivis')}
                    className={cn("transition-colors", activeTab === 'Suivis' && "text-white")}
                >
                    Suivis
                </button>
                 <button 
                    onClick={() => setActiveTab('Pour toi')}
                    className={cn("transition-colors relative", activeTab === 'Pour toi' && "text-white")}
                >
                    Pour toi
                    {activeTab === 'Pour toi' && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 w-6 bg-white rounded-full"></div>}
                </button>
            </div>

             <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <Search />
            </Button>
        </header>
    );
};


const VideoPost = ({ video }: { video: JojoVideo }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const handleVideoClick = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };
    
    // This effect handles intersection observer logic to play/pause videos on scroll
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    videoElement.play().catch(e => console.error("Autoplay failed", e));
                    setIsPlaying(true);
                } else {
                    videoElement.pause();
                    setIsPlaying(false);
                }
            },
            { threshold: 0.5 } // Play when 50% of the video is visible
        );

        observer.observe(videoElement);

        return () => {
            if (videoElement) {
                observer.unobserve(videoElement);
            }
        };
    }, []);


    return (
        <div className="h-full w-full relative rounded-lg overflow-hidden snap-start" onClick={handleVideoClick}>
            <video
                ref={videoRef}
                src={video.videoUrl}
                loop
                playsInline
                muted // Muted is often required for autoplay to work
                className="h-full w-full object-cover"
                poster="https://placehold.co/1080x1920.png"
                data-ai-hint="short video people"
            />
            
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                    <Play className="h-16 w-16 text-white/70" />
                </div>
            )}

            {/* Bottom Info Panel */}
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white bg-gradient-to-t from-black/70 to-transparent z-10">
                <div className="pr-16"> {/* Padding to not overlap with action buttons */}
                    <p className="font-bold text-sm">{video.user.handle}</p>
                    <p className="text-sm mt-1">{video.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                        <Music className="h-4 w-4" />
                        <span>{video.songTitle}</span>
                    </div>
                </div>
            </div>

             {/* Right Action Panel */}
            <div className="absolute bottom-20 right-2 z-10 flex flex-col items-center gap-4 text-white">
                <div className="relative mb-2">
                    <Avatar className="h-12 w-12 border-2 border-white">
                        <AvatarImage src={video.user.avatar} />
                        <AvatarFallback>{video.user.name[0]}</AvatarFallback>
                    </Avatar>
                    <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-black">
                        <Plus className="h-4 w-4 text-white" />
                    </button>
                </div>

                <div className="flex flex-col items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-auto flex-col">
                        <Heart className="h-8 w-8" />
                        <span className="text-xs font-semibold">{formatKiloMega(video.likes)}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-auto flex-col mt-2">
                        <MessageCircle className="h-8 w-8" />
                        <span className="text-xs font-semibold">{formatKiloMega(video.comments)}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-auto flex-col mt-2">
                        <Bookmark className="h-8 w-8" />
                        <span className="text-xs font-semibold">{formatKiloMega(video.bookmarks)}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-auto flex-col mt-2">
                        <Share2 className="h-8 w-8" />
                        <span className="text-xs font-semibold">{formatKiloMega(video.shares)}</span>
                    </Button>
                </div>

                <div className="mt-2 relative h-12 w-12">
                    <div className="absolute inset-2 bg-zinc-800 rounded-full animate-spin [animation-duration:4s]"></div>
                     <Image src={video.user.avatar} alt="audio source" layout="fill" className="rounded-full p-3 border-2 border-zinc-700" />
                </div>
            </div>
        </div>
    );
};


export function MonPaysVideoFeedClient({ videos }: { videos: JojoVideo[] }) {
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
        };
        fetchUser();
    }, []);

    if (isLiveMode) {
        return <LiveStreamView user={user} onExit={() => setIsLiveMode(false)} />;
    }

    return (
        <div className="h-screen w-screen bg-black relative">
            <JojoHeader onGoLiveClick={() => setIsLiveMode(true)} />
            <div className="overflow-y-auto snap-y snap-mandatory h-full w-full">
                {videos.map(video => (
                    <VideoPost key={video.id} video={video} />
                ))}
            </div>
        </div>
    );
}
