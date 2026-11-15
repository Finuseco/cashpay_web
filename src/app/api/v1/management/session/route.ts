import {NextResponse} from 'next/server';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {requireSuperAgent} from '@/lib/super-agent-access';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const user=await getAuthenticatedUser();
  if(!user)return NextResponse.json({success:false,error:'Votre session a expiré. Reconnectez-vous.'},{status:401});
  if(!['Admin','SuperAgent','SubSuperAgent'].includes(user.role))return NextResponse.json({success:false,error:'Accès réservé aux gestionnaires.'},{status:403});
  const actor=await requireSuperAgent(user.id);
  return NextResponse.json({success:true,user:actor},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({success:false,error:'Session de gestion indisponible. Vérifiez la juridiction et le statut du compte.'},{status:503});}
}
