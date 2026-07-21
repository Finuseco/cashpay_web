import { MonPaysVideoFeedClient } from '@/components/monpays/video-feed-client';
import { getJojoVideos } from '@/lib/actions/cinema.actions';

export default async function MonPaysVideosPage() {
    const videos = await getJojoVideos();
    return <MonPaysVideoFeedClient videos={videos} />;
}
