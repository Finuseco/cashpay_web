import { JojoFeedClient } from '@/components/cinema/jojo-feed-client';
import { getJojoVideos } from '@/lib/actions/cinema.actions';

export default async function JojoPage() {
    const videos = await getJojoVideos();
    return <JojoFeedClient videos={videos} />;
}
