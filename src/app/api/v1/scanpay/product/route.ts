import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {lookupScan} from '@/lib/scanpay';
export async function POST(request:Request){try{if(!await getAuthenticatedUser())return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});const body=await request.json();const scan=await lookupScan(body.productId?JSON.stringify({type:'PRODUCT',productId:String(body.productId)}):String(body.barcode||''));return NextResponse.json({success:true,scan},{headers:{'Cache-Control':'private, no-store'}});}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:400});}}
