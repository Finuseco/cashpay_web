import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {lookupScan} from '@/lib/scanpay';
export async function POST(request:Request){try{if(!await getAuthenticatedUser())return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});const body=await request.json();return NextResponse.json({success:true,wallet:await lookupScan(JSON.stringify({type:'WALLET',walletId:body.walletId}))});}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:400});}}
