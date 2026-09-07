import { MonPaysVideoFeedClient } from '@/components/monpays/video-feed-client';

export default function MonPaysVideosPage() {
    const videos = [];

    return <MonPaysVideoFeedClient videos={videos} />;
}
