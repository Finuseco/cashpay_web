import { NextResponse } from 'next/server';
import { appointInterAgent } from '@/lib/inter-agent';
export async function POST(request:Request) {
 try { const body=await request.json(); return NextResponse.json(await appointInterAgent(body)); }
 catch(e:any) { return NextResponse.json({success:false,error:e.message},{status:400}); }
}
