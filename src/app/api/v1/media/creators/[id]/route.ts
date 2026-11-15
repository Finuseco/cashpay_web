import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
export const dynamic='force-dynamic';
const publicUrl=(value:string|null)=>value?.startsWith('/')?`https://app.cashpay-all.com${value}`:value;
export async function GET(request:NextRequest,{params}:{params:{id:string}}){
 const id=Number(params.id),section=request.nextUrl.searchParams.get('sounds')||'original';
 const offset=Number(request.nextUrl.searchParams.get('offset')||0),limit=Number(request.nextUrl.searchParams.get('limit')||20);
 if(!Number.isSafeInteger(id)||id<=0||!['original','used'].includes(section)||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>50)return NextResponse.json({success:false,error:'Paramètres de profil invalides.'},{status:400});
 try{
  const viewer=await getAuthenticatedUser();
  const {rows}=await db.query(`SELECT u.id,u.full_name,u.profile_photo,
   (SELECT COUNT(DISTINCT follower_user_id)::int FROM user_followers WHERE followed_user_id=u.id) AS followers,
   (SELECT COUNT(DISTINCT followed_user_id)::int FROM user_followers WHERE follower_user_id=u.id) AS following,
   EXISTS(SELECT 1 FROM user_followers WHERE followed_user_id=u.id AND follower_user_id=$2) AS is_following,
   (SELECT COUNT(*)::int FROM media WHERE owner_type='user' AND owner_id=u.id AND visibility='public' AND (expires_at IS NULL OR expires_at>NOW())) AS media,
   (SELECT COUNT(*)::int FROM media WHERE owner_type='user' AND owner_id=u.id AND media_type='video' AND visibility='public' AND (expires_at IS NULL OR expires_at>NOW())) AS videos,
   (SELECT COUNT(*)::int FROM media_likes l JOIN media m ON m.id=l.media_id WHERE m.owner_type='user' AND m.owner_id=u.id AND m.visibility='public' AND (m.expires_at IS NULL OR m.expires_at>NOW())) AS likes
   FROM users u WHERE u.id=$1`,[id,viewer?.id||null]);
  if(!rows.length)return NextResponse.json({success:false,error:'Créateur introuvable.'},{status:404});
  const {rows:sounds}=await db.query(`SELECT m.id AS "videoId",COALESCE(s.source_media_id,m.id) AS "sourceId",
   COALESCE(s.title,'Son original') AS title,COALESCE(s.author_user_id,m.owner_id) AS "authorId",a.full_name AS "authorName",a.profile_photo AS "authorAvatar",
   COALESCE(root.allow_reuse,FALSE) AS "allowReuse",COALESCE(source.file_url,'https://app.cashpay-all.com'||source.file_path) AS url,
   COALESCE(m.thumbnail_url,'https://app.cashpay-all.com/api/v1/media/videos/'||m.id||'/thumbnail') AS "thumbnailUrl"
   FROM media m LEFT JOIN onchat_video_sounds s ON s.media_id=m.id
   JOIN users a ON a.id=COALESCE(s.author_user_id,m.owner_id)
   JOIN media source ON source.id=COALESCE(s.source_media_id,m.id)
   LEFT JOIN onchat_video_sounds root ON root.media_id=source.id
   WHERE m.owner_type='user' AND m.owner_id=$1 AND m.media_type='video' AND m.visibility='public' AND (m.expires_at IS NULL OR m.expires_at>NOW())
   AND source.visibility='public' AND (source.expires_at IS NULL OR source.expires_at>NOW())
   AND (($2='original' AND s.source_media_id IS NULL) OR ($2='used' AND s.source_media_id IS NOT NULL))
   ORDER BY m.created_at DESC,m.id DESC LIMIT $3 OFFSET $4`,[id,section,limit+1,offset]);
  const u=rows[0];
  return NextResponse.json({success:true,creator:{id:Number(u.id),name:u.full_name,avatarUrl:publicUrl(u.profile_photo)},stats:{followers:u.followers,following:u.following,videos:u.videos,media:u.media,likes:u.likes},isFollowing:u.is_following,
   sounds:sounds.slice(0,limit).map(sound=>({...sound,authorAvatar:publicUrl(sound.authorAvatar)})),pagination:{offset,limit,hasMore:sounds.length>limit}},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){console.error('[OnChat creator media]',error);return NextResponse.json({success:false,error:'Profil média indisponible. Vérifiez la configuration des abonnements et du catalogue audio.'},{status:503});}
}
