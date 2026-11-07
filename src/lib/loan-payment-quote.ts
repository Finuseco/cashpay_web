import {signLoanPayment} from '@/lib/loan-payment-intent';
import {db} from '@/lib/db';
import {calculateTransactionFee} from '@/lib/actions/wallet.actions';
export async function loanPaymentQuote(user:any,loanId:number,requestedAmount?:number,installmentId?:number){
 const loan=(await db.query("SELECT id,currency,remaining_balance FROM loans WHERE id=$1 AND user_id=$2 AND status='approved'",[loanId,user.id])).rows[0];if(!loan)throw new Error('Prêt actif introuvable.');
 let amount=Number(requestedAmount);
 if(installmentId!==undefined){const inst=(await db.query("SELECT amount,penalty_amount,paid_amount FROM loan_installments WHERE id=$1 AND loan_id=$2 AND status<>'paid'",[installmentId,loanId])).rows[0];if(!inst)throw new Error('Échéance introuvable.');amount=Math.min(Number(inst.amount)+Number(inst.penalty_amount)-Number(inst.paid_amount),Number(loan.remaining_balance));}
 amount=Math.round(amount*100)/100;if(!Number.isFinite(amount)||amount<=0||amount>Number(loan.remaining_balance))throw new Error('Montant supérieur à la dette ou invalide.');
 const fee=Number(await calculateTransactionFee(amount,loan.currency,'LR',user.country));if(!Number.isFinite(fee)||fee<0)throw new Error('Frais de remboursement indisponibles.');
 const quoteToken=signLoanPayment({userId:user.id,loanId,installmentId:installmentId??null,amount,currency:loan.currency,fee,remainingBefore:Number(loan.remaining_balance)});
 return {quoteToken,loanId,installmentId:installmentId??null,amount,currency:loan.currency,fee,totalDebit:amount+fee,remaining:Math.round((Number(loan.remaining_balance)-amount)*100)/100};
}
