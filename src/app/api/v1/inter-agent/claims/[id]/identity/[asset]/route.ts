import {NextResponse} from 'next/server';
import {promises as fs} from 'fs';
import path from 'path';
import {interIdentityAsset} from '@/lib/inter-agent';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:{id:string;asset:string}}){
 try{
  const id=Number(params.id);if(!Number.isSafeInteger(id)||id<=0)return new NextResponse(null,{status:404});
  const stored=await interIdentityAsset(id,params.asset);
  // Never fetch an arbitrary URL or redirect to a public KYC path.
  if(!/^\/images\/(documents|signatures)\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|gif|pdf)$/i.test(stored))return new NextResponse('Format de pièce indisponible.',{status:404});
  const base=await fs.realpath(path.join(process.cwd(),'public','images'));
  const file=await fs.realpath(path.join(process.cwd(),'public',stored));
  if(!file.startsWith(base+path.sep))return new NextResponse(null,{status:404});
  const types:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.pdf':'application/pdf'};
  return new NextResponse(new Uint8Array(await fs.readFile(file)),{headers:{'Content-Type':types[path.extname(file).toLowerCase()],'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':'inline'}});
 }catch{return new NextResponse('Pièce indisponible ou accès interdit.',{status:403,headers:{'Cache-Control':'private, no-store'}});}
}
