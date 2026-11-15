import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {lookupScan} from '@/lib/scanpay';
export {POST} from './payment/route';
export async function GET(request:Request){try{if(!await getAuthenticatedUser())return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});return NextResponse.json({success:true,scan:await lookupScan(new URL(request.url).searchParams.get('data')||'')},{headers:{'Cache-Control':'private, no-store'}});}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:400});}}
