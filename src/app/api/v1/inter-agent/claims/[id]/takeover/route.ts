import {NextResponse} from 'next/server';
import {takeOverInterClaim} from '@/lib/inter-agent';
export async function POST(request:Request,{params}:{params:{id:string}}){
 try{const id=Number(params.id);if(!Number.isSafeInteger(id)||id<=0)throw new Error('Dossier invalide.');const body=await request.json();return NextResponse.json(await takeOverInterClaim(id,String(body.pin||''),String(body.maxNet||''),String(body.currency||'')));}
 catch(e:any){return NextResponse.json({success:false,error:e.message},{status:400});}
}
