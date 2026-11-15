import { NextResponse } from 'next/server';
import { respondDirectCall } from '@/lib/onchat-direct-calls';
export async function POST(request:Request,{params}:{params:{callId:string}}) {
 try {const body=await request.json();return NextResponse.json(await respondDirectCall(params.callId,String(body.status || '')));}
 catch(e:any) {return NextResponse.json({success:false,error:e.message},{status:400});}
}
