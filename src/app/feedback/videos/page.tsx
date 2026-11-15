import {OnChatVideoFeed} from '@/components/feedback/onchat-video-feed';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:{publisherId?:string}}){const user=await getAuthenticatedUser();const id=Number(searchParams.publisherId);return <OnChatVideoFeed viewerId={user?.id} publisherId={Number.isSafeInteger(id)&&id>0?id:undefined}/>;}
