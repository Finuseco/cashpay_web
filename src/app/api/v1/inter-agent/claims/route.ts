import { NextResponse } from 'next/server';
import { interDashboard } from '@/lib/inter-agent';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 try { return NextResponse.json(await interDashboard(Number(new URL(request.url).searchParams.get('page') || 0))); }
 catch(e:any) { return NextResponse.json({success:false,error:e.message},{status:403}); }
}
