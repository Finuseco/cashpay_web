import { CinemaClient } from '@/components/cinema/cinema-client';
import { getMovies, getSeries, getGames, getContinueWatching } from '@/lib/actions/cinema.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export default async function CinemaPage() {
    const user = await getAuthenticatedUser();
    
    // Fetch all data in parallel
    const [movies, series, games, continueWatching] = await Promise.all([
        getMovies(),
        getSeries(),
        getGames(),
        user ? getContinueWatching(user.id) : [],
    ]);
    
    return <CinemaClient movies={movies} series={series} games={games} continueWatching={continueWatching} />;
}
