import {OnChatVideoFeed} from '@/components/feedback/onchat-video-feed';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:{id:string}}){const id=Number(params.id);if(!Number.isSafeInteger(id)||id<=0)notFound();const user=await getAuthenticatedUser();return <OnChatVideoFeed viewerId={user?.id} initialVideoId={id}/>;}
