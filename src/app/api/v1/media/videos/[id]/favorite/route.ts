import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
export const dynamic='force-dynamic';
async function favorite(id:string,enabled:boolean){
 const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});
 const mediaId=Number(id);if(!Number.isSafeInteger(mediaId)||mediaId<=0)return NextResponse.json({success:false,error:'Vidéo invalide.'},{status:400});
 try{
  if(enabled){
   const result=await db.query(`INSERT INTO onchat_video_favorites(user_id,media_id) SELECT $1,id FROM media WHERE id=$2 AND media_type='video' AND visibility='public' AND (expires_at IS NULL OR expires_at>NOW()) ON CONFLICT(user_id,media_id) DO UPDATE SET media_id=EXCLUDED.media_id RETURNING media_id`,[user.id,mediaId]);
   if(!result.rows.length)return NextResponse.json({success:false,error:'Vidéo indisponible.'},{status:404});
  }else await db.query('DELETE FROM onchat_video_favorites WHERE user_id=$1 AND media_id=$2',[user.id,mediaId]);
  const count=await db.query('SELECT COUNT(*)::int AS total FROM onchat_video_favorites WHERE media_id=$1',[mediaId]);
  return NextResponse.json({success:true,isFavorite:enabled,favorites:count.rows[0].total},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({success:false,error:'Favoris indisponibles. Réessayez.'},{status:503});}
}
export async function PUT(_request:Request,{params}:{params:{id:string}}){return favorite(params.id,true);}
export async function DELETE(_request:Request,{params}:{params:{id:string}}){return favorite(params.id,false);}
