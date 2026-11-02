import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {meetingConnection} from '@/lib/meeting-media';
import {MeetingAccessError} from '@/lib/meeting-access';
export const dynamic='force-dynamic';
export async function POST(_request:Request,{params}:{params:{meetCode:string}}){
 try{const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});return NextResponse.json(await meetingConnection(params.meetCode,user.id),{headers:{'Cache-Control':'private, no-store'}});}
 catch(error){return NextResponse.json({success:false,error:error instanceof MeetingAccessError?error.message:'Connexion au serveur média indisponible.'},{status:error instanceof MeetingAccessError?error.status:503});}
}
