import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
export const dynamic='force-dynamic';
async function access(code:string,userId:number){return (await db.query(`SELECT m.id FROM meetings m JOIN meeting_participants p ON p.meeting_id=m.id WHERE m.meeting_provider_id=$1 AND m.status='active' AND p.user_id=$2 AND p.left_at IS NULL AND p.removed_at IS NULL`,[code,userId])).rows[0];}
export async function GET(request:Request,{params}:{params:{meetCode:string}}){
 try{const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});const meeting=await access(params.meetCode,user.id);if(!meeting)return NextResponse.json({success:false,error:'Accès réservé aux participants.'},{status:403});
 const result=await db.query(`SELECT msg.id::text,msg.content,msg.created_at AS "createdAt",u.id AS "userId",u.full_name AS name,u.profile_photo AS avatar FROM onchat_meeting_messages msg JOIN users u ON u.id=msg.user_id WHERE msg.meeting_id=$1 ORDER BY msg.id DESC LIMIT 100`,[meeting.id]);
 return NextResponse.json({success:true,messages:result.rows.reverse()},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({success:false,error:'Discussion indisponible.'},{status:503});}
}
export async function POST(request:Request,{params}:{params:{meetCode:string}}){
 try{const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});const body=await request.json();const content=typeof body.content==='string'?body.content.trim():'';if(!content||content.length>2000)return NextResponse.json({success:false,error:'Message requis (2 000 caractères maximum).'},{status:400});
 // Membership and insertion are one statement, so a kicked account cannot race a prior access check.
 const result=await db.query(`INSERT INTO onchat_meeting_messages(meeting_id,user_id,content) SELECT m.id,$2,$3 FROM meetings m JOIN meeting_participants p ON p.meeting_id=m.id WHERE m.meeting_provider_id=$1 AND m.status='active' AND p.user_id=$2 AND p.left_at IS NULL AND p.removed_at IS NULL RETURNING id::text`,[params.meetCode,user.id,content]);
 if(!result.rows.length)return NextResponse.json({success:false,error:'Accès réservé aux participants.'},{status:403});
 await db.query("SELECT pg_notify('onchat_meeting_chat',$1)",[JSON.stringify({meetCode:params.meetCode,id:result.rows[0].id})]);return NextResponse.json({success:true,id:result.rows[0].id},{status:201});
 }catch{return NextResponse.json({success:false,error:'Envoi non confirmé.'},{status:503});}
}
