import {NextResponse} from 'next/server';
import {requireSuperAgent} from '@/lib/super-agent-access';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
const contracts:Record<string,Record<string,string[]>>={
 accounts:{users:['id','role','status','country','province','pin_hash'],wallets:['user_id','balances']},
 identity:{user_documents:['user_id','id_type','id_number','id_front_image']},
 subscriptions:{subscriptions:['id','user_id','service_name','amount','operator_name','smartcard_number','status','transaction_id','request_key','created_at'],tv_subscription_fees:['id','provider_code','provider_name','package_code','package_name','price_usd','base_price','base_currency','is_active','metadata']},
 loans:{loans:['id','user_id','currency','status','repayment_frequency'],loan_installments:['loan_id','amount','penalty_amount','paid_amount','due_date','status']},
 interAgents:{inter_agent_memberships:['user_id','country','province','kind','active'],inter_claim_cases:['claim_id','agent_user_id','status'],inter_claim_audit:['claim_id','actor_user_id','action','created_at']},
 audit:{super_agent_interventions:['admin_user_id','target_user_id','action_type','detail']}
};
export async function GET(){
 try{
  await requireSuperAgent();
  const tables=[...new Set(Object.values(contracts).flatMap(contract=>Object.keys(contract)))];
  const entries=await Promise.all(tables.map(async table=>{const {rows}=await db.query('SELECT attname FROM pg_attribute WHERE attrelid=to_regclass($1) AND attnum>0 AND NOT attisdropped',[table]);return [table,new Set(rows.map(row=>row.attname))] as const;}));
  const columns=new Map(entries);
  const services=Object.entries(contracts).map(([name,contract])=>{const missing=Object.entries(contract).flatMap(([table,fields])=>fields.filter(field=>!columns.get(table)?.has(field)).map(field=>`${table}.${field}`));return {name,available:missing.length===0,missing};});
  const {rows:roles}=await db.query("SELECT e.enumlabel FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid JOIN pg_enum e ON e.enumtypid=CASE WHEN t.typtype='d' THEN t.typbasetype ELSE t.oid END WHERE a.attrelid='users'::regclass AND a.attname='role' ORDER BY e.enumsortorder");
  return NextResponse.json({success:true,checkedAt:new Date().toISOString(),services,roles:roles.map(row=>row.enumlabel),notice:'Un schéma disponible ne prouve pas qu’un paiement ou un service fournisseur a été testé.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({success:false,error:'Diagnostic réservé aux gestionnaires actifs avec juridiction valide.'},{status:403});}
}
