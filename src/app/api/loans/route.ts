import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {requireSuperAgent,regionalScope} from '@/lib/super-agent-access';
export async function GET(){
 try{const actor=await requireSuperAgent();const scope=actor.role==='Admin'?{sql:'TRUE',values:[]}:await regionalScope(actor.country);
 const {rows}=await db.query(`SELECT l.id,u.full_name AS "clientName",u.id_wallet AS "cpNumber",l.amount,l.currency,l.status,l.request_date AS "requestDate",l.duration,l.interest_rate AS "interestRate",l.remaining_balance AS "amountDue",l.status AS "repaymentStatus",(SELECT COUNT(*)::int FROM loan_installments li WHERE li.loan_id=l.id AND li.due_date<NOW() AND li.status<>'paid') AS "latePayments",(SELECT COALESCE(SUM(li.penalty_amount),0) FROM loan_installments li WHERE li.loan_id=l.id) AS "penaltyAmount",NULL AS "riskScore",NULL AS "agencyId" FROM loans l JOIN users u ON u.id=l.user_id WHERE ${scope.sql} ORDER BY l.request_date DESC LIMIT 500`,scope.values);
 return NextResponse.json(rows,{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({success:false,error:'Accès de gestionnaire requis.'},{status:403});}
}
