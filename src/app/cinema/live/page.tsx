import { LiveTvClient } from '@/components/cinema/live-tv-client';
import { getTvChannels } from '@/lib/actions/cinema.actions';

export default async function LiveTvPage() {
    const channels = await getTvChannels();
    return <LiveTvClient channels={channels} />;
}
