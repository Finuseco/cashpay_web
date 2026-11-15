import {loanPaymentQuote} from '@/lib/loan-payment-quote';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { repayLoan } from '@/lib/actions/loan.actions';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const loanId = Number(body.loanId);
    const amount = Number(body.amount);

    if (!Number.isSafeInteger(loanId) || loanId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Identifiant du prêt invalide.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Montant de remboursement invalide.' },
        { status: 400 }
      );
    }

    const result = await repayLoan(user.id, loanId, amount,undefined,body.acceptedPayment);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error: any) {
    console.error('Loan repayment API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de rembourser le prêt.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request:NextRequest){try{const user=await getAuthenticatedUser();if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});const query=request.nextUrl.searchParams;const id=Number(query.get('loanId'));const installment=query.has('installmentId')?Number(query.get('installmentId')):undefined;if(!Number.isSafeInteger(id)||id<=0||installment!==undefined&&(!Number.isSafeInteger(installment)||installment<=0))throw new Error('Identifiant invalide.');return NextResponse.json({success:true,quote:await loanPaymentQuote(user,id,query.has('amount')?Number(query.get('amount')):undefined,installment)},{headers:{'Cache-Control':'private, no-store'}});}catch(e:any){return NextResponse.json({success:false,error:e.message},{status:400});}}
