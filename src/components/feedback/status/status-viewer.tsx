
'use client';

import { useState, useEffect } from 'react';
import type { StatusGroup, Status } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, MoreVertical, Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

const StatusContent = ({ status }: { status: Status }) => {
    if (status.type === 'text') {
        return (
            <div className="h-full w-full flex items-center justify-center p-8 text-center" style={{ backgroundColor: status.backgroundColor || '#333' }}>
                <p className="text-white text-3xl font-bold">{status.content}</p>
            </div>
        );
    }
    
    if (status.type === 'image') {
        return (
            <Image src={status.content} alt="Status image" layout="fill" objectFit="contain" />
        );
    }
    
    if (status.type === 'video') {
        return (
            <video src={status.content} autoPlay className="h-full w-full object-contain" />
        );
    }

    return null;
};


export function StatusViewer({
  statusGroups,
  initialGroupIndex,
  onClose
}: {
  statusGroups: StatusGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}) {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentGroup = statusGroups[currentGroupIndex];
  const currentStatus = currentGroup.statuses[currentStatusIndex];

  useEffect(() => {
    if (isPaused) return;

    setProgress(0);
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        return p + (100 / 50); // 5 seconds per status
      });
    }, 100);

    return () => clearInterval(timer);
  }, [currentStatusIndex, currentGroupIndex, isPaused]);
  
  useEffect(() => {
      if (progress >= 100) {
        if (currentStatusIndex < currentGroup.statuses.length - 1) {
          setCurrentStatusIndex(prev => prev + 1);
        } else if (currentGroupIndex < statusGroups.length - 1) {
          setCurrentGroupIndex(prev => prev + 1);
          setCurrentStatusIndex(0);
        } else {
          onClose();
        }
      }
  }, [progress, currentStatusIndex, currentGroup.statuses.length, currentGroupIndex, statusGroups.length, onClose]);
  
  const goToNextGroup = () => {
    if (currentGroupIndex < statusGroups.length - 1) {
        setCurrentGroupIndex(prev => prev + 1);
        setCurrentStatusIndex(0);
    }
  }

  const goToPrevGroup = () => {
    if (currentGroupIndex > 0) {
        setCurrentGroupIndex(prev => prev - 1);
        setCurrentStatusIndex(0);
    }
  }

  if (!currentGroup) {
      onClose();
      return null;
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsPaused(p => !p); }}>
        {/* Progress Bars */}
        <div className="absolute top-4 left-4 right-4 z-20 flex gap-1">
            {currentGroup.statuses.map((_, index) => (
                <div key={index} className="flex-1 h-1 bg-white/30 rounded-full">
                    <div 
                        className="h-1 bg-white rounded-full" 
                        style={{ width: `${index < currentStatusIndex ? 100 : (index === currentStatusIndex ? progress : 0)}%`}}
                    />
                </div>
            ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-4 right-4 z-20 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={currentGroup.contact.profile_photo || ''} />
                    <AvatarFallback>{currentGroup.contact.full_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-white font-bold">{currentGroup.contact.full_name}</p>
                    <p className="text-zinc-300 text-xs">Il y a 5 heures</p>
                </div>
            </div>
            <div className="flex items-center">
                <Button variant="ghost" size="icon" className="text-white" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsPaused(p => !p); }}>
                    {isPaused ? <Play /> : <Pause />}
                </Button>
                 <Button variant="ghost" size="icon" className="text-white"><MoreVertical /></Button>
                 <Button variant="ghost" size="icon" className="text-white" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose(); }}><X /></Button>
            </div>
        </div>
        
        {/* Navigation */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-30 h-full w-1/3 group" onClick={(e: React.MouseEvent) => { e.stopPropagation(); goToPrevGroup(); }}>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 rounded-full opacity-0 group-hover:opacity-100">
                <ChevronLeft />
            </div>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-30 h-full w-1/3 group" onClick={(e: React.MouseEvent) => { e.stopPropagation(); goToNextGroup(); }}>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 rounded-full opacity-0 group-hover:opacity-100">
                <ChevronRight />
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
            <StatusContent status={currentStatus} />
        </div>
    </div>
  );
}
