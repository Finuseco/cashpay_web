import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { soundForVideo } from '@/lib/video-sounds';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: { id: string } }) {
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ success: false, error: 'Vidéo invalide.' }, { status: 400 });
    try {
        const sound = await soundForVideo(id);
        return NextResponse.json({ success: true, sound });
    } catch { return NextResponse.json({ success: false, error: 'Catalogue audio indisponible. Vérifiez la migration des sons OnChat.' }, { status: 503 }); }
}

export async function PATCH(request:Request,{params}:{params:{id:string}}){
 const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});
 const id=Number(params.id);if(!Number.isSafeInteger(id)||id<=0)return NextResponse.json({success:false,error:'Vidéo invalide.'},{status:400});
 try{
  const body=await request.json();
  if(typeof body.allowReuse!=='boolean'||(body.allowReuse&&body.rightsConfirmed!==true))return NextResponse.json({success:false,error:'Confirmez vos droits sur ce son original.'},{status:400});
  const result=await db.query(`INSERT INTO onchat_video_sounds(media_id,author_user_id,title,allow_reuse,rights_confirmed_at)
   SELECT m.id,$2,$3,$4,CASE WHEN $4 THEN NOW() ELSE NULL END FROM media m
   WHERE m.id=$1 AND m.owner_type='user' AND m.owner_id=$2 AND m.media_type='video' AND m.visibility='public' AND (m.expires_at IS NULL OR m.expires_at>NOW())
   ON CONFLICT(media_id) DO UPDATE SET allow_reuse=EXCLUDED.allow_reuse,rights_confirmed_at=CASE WHEN EXCLUDED.allow_reuse THEN NOW() ELSE onchat_video_sounds.rights_confirmed_at END
   WHERE onchat_video_sounds.author_user_id=$2 AND onchat_video_sounds.source_media_id IS NULL RETURNING media_id`,[id,user.id,String(body.title||'Son original').trim().slice(0,160),body.allowReuse]);
  if(!result.rows.length)return NextResponse.json({success:false,error:'Seul l’auteur de ce son original peut en modifier les droits.'},{status:403});
  return NextResponse.json({success:true,sound:await soundForVideo(id)});
 }catch{return NextResponse.json({success:false,error:'Droits audio indisponibles.'},{status:503});}
}
