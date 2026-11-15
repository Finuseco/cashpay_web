import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {quoteScan} from '@/lib/scanpay';
export async function POST(request:Request){try{const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});const body=await request.json();return NextResponse.json({success:true,quote:await quoteScan(user,{...body,type:'PAYMENT_REQUEST'},body.paymentCurrency||body.currency)});}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:400});}}
