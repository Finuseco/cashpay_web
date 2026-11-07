import {NextResponse} from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {randomUUID} from 'crypto';
import {db} from '@/lib/db';
import {generateVideoThumbnail} from '@/lib/video-thumbnail';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const jobs=new Map<number,Promise<boolean>>();
export async function GET(_request:Request,{params}:{params:{id:string}}){
 const id=Number(params.id);if(!Number.isSafeInteger(id)||id<=0)return new NextResponse(null,{status:400});
 try{
  const {rows}=await db.query("SELECT file_path FROM media WHERE id=$1 AND media_type='video' AND visibility='public' AND (expires_at IS NULL OR expires_at>NOW())",[id]);
  if(!rows[0]?.file_path)return new NextResponse(null,{status:404});
  const root=path.resolve(process.cwd(),'public'),input=path.resolve(root,String(rows[0].file_path).replace(/^\/+/,''));
  if(!input.startsWith(root+path.sep))return new NextResponse(null,{status:404});
  const output=path.join(root,'.onchat-thumbnails',`${id}.jpg`);
  if(!(await fs.stat(output).catch(()=>null))){
   if(!jobs.has(id)){
    if(jobs.size>=2)return new NextResponse(null,{status:503,headers:{'Retry-After':'5'}});
    const job=(async()=>{await fs.mkdir(path.dirname(output),{recursive:true});const temporary=path.join(path.dirname(output),`${id}-${randomUUID()}.jpg`);if(!await generateVideoThumbnail(input,temporary))return false;await fs.rename(temporary,output);return true;})();
    jobs.set(id,job);void job.finally(()=>jobs.delete(id)).catch(()=>{});
   }
   if(!await jobs.get(id))return new NextResponse(null,{status:503,headers:{'Retry-After':'30'}});
  }
  return new NextResponse(new Uint8Array(await fs.readFile(output)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
 }catch{return new NextResponse(null,{status:503});}
}
