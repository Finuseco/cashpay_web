import { NextResponse } from 'next/server';
import { startDirectCall } from '@/lib/onchat-direct-calls';
export async function POST(request:Request) {
 try {const body=await request.json();return NextResponse.json(await startDirectCall(body.receiverWalletId,body.isVideo===true));}
 catch(e:any) {return NextResponse.json({success:false,error:e.message},{status:400});}
}
