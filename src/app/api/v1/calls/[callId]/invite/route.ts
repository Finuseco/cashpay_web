import { NextResponse } from 'next/server';
import { inviteToDirectCall } from '@/lib/onchat-direct-calls';
export async function POST(request:Request,{params}:{params:{callId:string}}) {
 try {const body=await request.json();return NextResponse.json(await inviteToDirectCall(params.callId,body));}
 catch(e:any) {return NextResponse.json({success:false,error:e.message},{status:400});}
}
