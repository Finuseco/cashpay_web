import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {lookupScan,quoteScan} from '@/lib/scanpay';
export async function POST(request:Request){
 try{const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});const body=await request.json();
 const result=body.action==='quote'?{type:'QUOTE',quote:await quoteScan(user,body.scan,body.paymentCurrency||'USD')}:await lookupScan(String(body.value||body.data||body.barcode||''));
 return NextResponse.json({success:true,scan:result},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e:any){return NextResponse.json({success:false,error:e.message},{status:400});}
}
