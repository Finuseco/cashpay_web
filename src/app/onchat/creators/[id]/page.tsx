import {notFound} from 'next/navigation';
import {CreatorMediaProfile} from '@/components/feedback/creator-media-profile';
export const dynamic='force-dynamic';
export default function Page({params}:{params:{id:string}}){const id=Number(params.id);if(!Number.isSafeInteger(id)||id<=0)notFound();return <CreatorMediaProfile id={id}/>;}
