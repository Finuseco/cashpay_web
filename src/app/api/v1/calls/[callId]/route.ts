import {NextResponse} from 'next/server';
import {getDirectCall} from '@/lib/onchat-direct-calls';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:{callId:string}}){try{return NextResponse.json(await getDirectCall(params.callId));}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:403});}}
