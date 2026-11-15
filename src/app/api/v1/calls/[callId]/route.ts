import {NextResponse} from 'next/server';
import {getDirectCall} from '@/lib/onchat-direct-calls';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:{callId:string}}){try{return NextResponse.json(await getDirectCall(params.callId));}catch(e:any){const status=e.code==='AUTH_REQUIRED'?401:e.code==='CALL_ENDED'?410:e.code==='CALL_FORBIDDEN'?403:e.code==='CALL_NOT_FOUND'?404:503;return NextResponse.json({success:false,error:status===503?'Appel momentanément indisponible. Réessayez.':e.message},{status});}}
