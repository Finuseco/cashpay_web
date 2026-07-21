
"use client";

import Image from "next/image";
import type { Movie } from "@/lib/types";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { cn } from "@/lib/utils";

export const MovieCard = ({ movie }: { movie: Movie }) => {
  const { openAlert } = useAlertDialog();

  const handlePlay = () => {
    openAlert({
        variant: 'info',
        title: 'Bientôt disponible',
        description: `La lecture de "${movie.title}" sera bientôt disponible.`,
    })
  };

  return (
    <div 
        className="group relative rounded-md overflow-hidden cursor-pointer aspect-[2/3] w-36 sm:w-44 flex-shrink-0"
        onClick={handlePlay}
    >
      <Image
        src={movie.coverPath}
        alt={movie.title}
        layout="fill"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        data-ai-hint={movie.dataAiHint}
      />
    </div>
  );
};
