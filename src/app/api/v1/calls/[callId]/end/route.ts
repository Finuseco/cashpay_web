import { NextResponse } from 'next/server';
import { finishDirectCall } from '@/lib/onchat-direct-calls';
export async function POST(request:Request,{params}:{params:{callId:string}}) {
 try {const body=await request.json();return NextResponse.json(await finishDirectCall(params.callId));}
 catch(e:any) {return NextResponse.json({success:false,error:e.message},{status:400});}
}
