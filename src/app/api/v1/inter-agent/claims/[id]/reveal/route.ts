import { NextResponse } from 'next/server';
import { revealInterClaim } from '@/lib/inter-agent';
export async function POST(request:Request,{params}:{params:{id:string}}) {
 try { const body=await request.json(); const id=Number(params.id); if (!Number.isSafeInteger(id)||id<=0) throw new Error('Réclamation invalide.'); return NextResponse.json(await revealInterClaim(id,String(body.pin||''),{maxNet:String(body.maxNet||''),currency:String(body.currency||'')})); }
 catch(e:any) { return NextResponse.json({success:false,error:e.message},{status:400}); }
}
