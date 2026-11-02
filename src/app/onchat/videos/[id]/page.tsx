import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedVideoPlayer } from '@/components/onchat/shared-video-player';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Vidéo OnChat',
  description: 'Regardez cette vidéo et retrouvez son auteur sur OnChat.',
};

export default async function SharedVideoPage({ params }: { params: { id: string } }) {
  if (!/^[1-9]\d*$/.test(params.id)) notFound();
  const videoId = Number(params.id);
  if (!Number.isSafeInteger(videoId)) notFound();
  const user = await getAuthenticatedUser();
  return <SharedVideoPlayer videoId={videoId} viewerId={user?.id || 0} />;
}
