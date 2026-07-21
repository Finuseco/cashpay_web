
"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Movie } from "@/lib/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ContinueWatchingCard } from "./continue-watching-card";
import { GameCard } from "./game-card";
import { MovieCard } from "./movie-card";

const MovieCarousel = ({ title, items, CardComponent }: { title: string, items: Movie[], CardComponent: React.FC<{ movie: Movie }> }) => (
    <div className="space-y-3">
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        <ScrollArea>
            <div className="flex space-x-4 pb-4">
                {items.map(item => <CardComponent key={item.id} movie={item} />)}
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    </div>
);


export function CinemaClient({ movies, series, games, continueWatching }: { movies: Movie[], series: Movie[], games: Movie[], continueWatching: Movie[] }) {
  const { t } = useTranslation();
  
  const trendingMovies = useMemo(() => movies.slice(0, 5), [movies]);

  return (
    <div className="space-y-8 p-4 md:p-8">
        <MovieCarousel title={t('Jeux mobiles', 'Jeux mobiles')} items={games} CardComponent={GameCard} />
        <MovieCarousel title={t('Reprendre la lecture', 'Reprendre la lecture')} items={continueWatching} CardComponent={ContinueWatchingCard} />
        <MovieCarousel title={t('cinemaTrending', 'Trending Now')} items={trendingMovies} CardComponent={MovieCard} />
        <MovieCarousel title={t('cinemaSeries', 'Popular TV Series')} items={series} CardComponent={MovieCard} />
        <MovieCarousel title={t('cinemaAction', 'Action & Adventure')} items={[...movies].reverse()} CardComponent={MovieCard} />
    </div>
  );
}
