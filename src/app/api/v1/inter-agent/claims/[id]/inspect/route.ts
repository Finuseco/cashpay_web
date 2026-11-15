import {NextResponse} from 'next/server';
import {inspectInterClaim} from '@/lib/inter-agent';
export async function POST(request:Request,{params}:{params:{id:string}}){try{const body=await request.json();const id=Number(params.id);if(!Number.isSafeInteger(id)||id<=0)throw new Error('Réclamation invalide.');return NextResponse.json(await inspectInterClaim(id,String(body.pin||'')));}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:403});}}
