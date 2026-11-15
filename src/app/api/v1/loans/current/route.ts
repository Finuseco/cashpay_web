import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLoanForUser } from '@/lib/actions/loan.actions';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const loan = await getLoanForUser(user.id);

    if(loan){
      const schedule=await db.query(`SELECT i.id,i.installment_number,i.due_date,i.amount,i.penalty_amount AS penalty,i.paid_amount,GREATEST(0,i.amount+i.penalty_amount-i.paid_amount) AS remaining_amount,i.status FROM loan_installments i JOIN loans l ON l.id=i.loan_id WHERE i.loan_id=$1 AND l.user_id=$2 ORDER BY i.installment_number`,[loan.id,user.id]);
      const repayments=await db.query('SELECT r.id,r.amount,r.type,r.payment_date FROM loan_repayments r JOIN loans l ON l.id=r.loan_id WHERE r.loan_id=$1 AND l.user_id=$2 ORDER BY r.payment_date,r.id',[loan.id,user.id]);
      Object.assign(loan,{schedule:schedule.rows.map(row=>({...row,amount:Number(row.amount),penalty:Number(row.penalty),paid_amount:Number(row.paid_amount),remaining_amount:Number(row.remaining_amount)})),repayments:repayments.rows.map(row=>({...row,amount:Number(row.amount)})),repaid_amount:repayments.rows.filter(row=>row.type==='repayment').reduce((sum,row)=>sum+Number(row.amount),0)});
    }
    return NextResponse.json({
      success: true,
      loan,
    });
  } catch (error: any) {
    console.error('Current loan API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer le prêt actuel.',
      },
      { status: 500 }
    );
  }
}
