
"use client";

import Image from "next/image";
import { PlayCircle, Info, MoreVertical } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { Movie } from "@/lib/types";
import { cn } from "@/lib/utils";

export const ContinueWatchingCard = ({ movie }: { movie: Movie }) => {
  return (
    <div className="w-64 sm:w-72 flex-shrink-0 space-y-2">
      <div className="relative group rounded-lg overflow-hidden cursor-pointer aspect-video bg-zinc-800">
        <Image
          src={movie.coverPath}
          alt={movie.title}
          layout="fill"
          className="object-cover"
          data-ai-hint={movie.dataAiHint}
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors" />
        <div className="absolute inset-0 flex items-center justify-center">
          <PlayCircle className="h-12 w-12 text-white/80 group-hover:text-white transition-colors" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <Progress value={movie.progress} className="h-1 bg-white/30 [&>div]:bg-red-600" />
        </div>
      </div>
      <div className="flex justify-between items-center px-1">
        <div className="text-xs text-zinc-300">
          <p className="font-bold text-sm text-white">{movie.title}</p>
          <p>{movie.duration}</p>
        </div>
        <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-white"><Info className="h-5 w-5"/></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-white"><MoreVertical className="h-5 w-5"/></Button>
        </div>
      </div>
    </div>
  );
};
