
"use client";

import Image from "next/image";
import type { Movie } from "@/lib/types";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

export const GameCard = ({ movie }: { movie: Movie }) => {
  const { openAlert } = useAlertDialog();

  const handlePlay = () => {
    openAlert({
        variant: 'info',
        title: 'Bientôt disponible',
        description: `Le jeu "${movie.title}" sera bientôt disponible.`,
    })
  };

  return (
    <div 
        className="group space-y-2 w-36 sm:w-44 flex-shrink-0 cursor-pointer"
        onClick={handlePlay}
    >
      <div className="relative rounded-lg overflow-hidden aspect-square bg-zinc-800">
         <Image
            src={movie.coverPath}
            alt={movie.title}
            layout="fill"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            data-ai-hint={movie.dataAiHint}
         />
         <div className="absolute top-2 right-2">
            <Badge className="bg-red-600 text-white">TOP 10</Badge>
         </div>
      </div>
      <div>
        <p className="font-semibold text-sm truncate">{movie.title}</p>
        <p className="text-xs text-zinc-400">{movie.category}</p>
      </div>
    </div>
  );
};
