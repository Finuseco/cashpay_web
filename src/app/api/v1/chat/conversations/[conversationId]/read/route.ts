import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {markChatRead} from '@/lib/chat-receipts';
export async function POST(_request:Request,{params}:{params:{conversationId:string}}){
 const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});
 try{await markChatRead(params.conversationId,user.id);return NextResponse.json({success:true,conversationId:params.conversationId,userId:user.id},{headers:{'Cache-Control':'private, no-store'}});}
 catch(error:any){return NextResponse.json({success:false,error:error.code==='42501'?'Conversation inaccessible.':'Lecture non confirmée. Réessayez.'},{status:error.code==='42501'?403:503});}
}
