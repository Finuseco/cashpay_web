import {NextResponse} from 'next/server';
import {quoteInterClaim} from '@/lib/inter-agent';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:{id:string}}){try{const id=Number(params.id);if(!Number.isSafeInteger(id)||id<=0)throw new Error('Réclamation invalide.');return NextResponse.json(await quoteInterClaim(id));}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:403});}}
