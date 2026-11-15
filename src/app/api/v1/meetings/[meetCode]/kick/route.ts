import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {controlMeeting} from '@/lib/meeting-control';
import {MeetingAccessError} from '@/lib/meeting-access';
export async function POST(request:Request,{params}:{params:{meetCode:string}}){
 try{const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});
 const body=await request.json();if(!Number.isSafeInteger(body.targetUserId)||body.targetUserId<=0)return NextResponse.json({success:false,error:'Participant invalide.'},{status:400});
 return NextResponse.json(await controlMeeting(params.meetCode,user.id,'kick',body.targetUserId));
 }catch(error){return NextResponse.json({success:false,error:error instanceof MeetingAccessError?error.message:'Contrôle non confirmé. Réessayez.'},{status:error instanceof MeetingAccessError?error.status:503});}
}
