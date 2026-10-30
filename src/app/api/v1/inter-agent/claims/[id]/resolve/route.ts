import { NextResponse } from 'next/server';
import { resolveInterClaim } from '@/lib/inter-agent';
export async function POST(request:Request,{params}:{params:{id:string}}) {
 try { const body=await request.json(); const id=Number(params.id); if (!Number.isSafeInteger(id)||id<=0) throw new Error('Réclamation invalide.'); return NextResponse.json(await resolveInterClaim({id,action:body.action,pin:String(body.pin||''),receipt:body.receipt,reason:body.reason,collected:body.collected===true})); }
 catch(e:any) { return NextResponse.json({success:false,error:e.message},{status:400}); }
}
