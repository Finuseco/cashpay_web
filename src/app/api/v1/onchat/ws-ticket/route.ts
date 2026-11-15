import {NextResponse} from 'next/server';
import jwt from 'jsonwebtoken';
import {randomUUID} from 'crypto';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
export const dynamic='force-dynamic';
export async function POST(){
 const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Session requise.'},{status:401});
 if(!process.env.JWT_SECRET)return NextResponse.json({success:false,error:'Signalisation non configurée.'},{status:503});
 const ticket=jwt.sign({id:user.id,id_wallet:user.id_wallet,role:user.role,scope:'onchat-ws-connect'},process.env.JWT_SECRET,{expiresIn:30,audience:'onchat-ws',jwtid:randomUUID(),algorithm:'HS256'});
 return NextResponse.json({success:true,ticket},{headers:{'Cache-Control':'no-store'}});
}
