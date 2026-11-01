import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {verifyUserPin} from '@/lib/actions/auth.actions';
import {payScan} from '@/lib/scanpay';
export async function POST(request:Request){try{
 const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});const body=await request.json();if(!/^\d{4}$/.test(String(body.pin||'')))throw new Error('PIN à quatre chiffres requis.');
 const pin=await verifyUserPin(user.id,String(body.pin));if(!pin.success)return NextResponse.json({success:false,error:pin.error||'PIN incorrect.'},{status:401});
 const result=await payScan(user,body.quoteToken);return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:400});}}
