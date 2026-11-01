/** Canonical flat-interest plan used by web, API, mobile and USSD. No currency conversion. */
export function loanPlan(amount:number,duration:number,rate:number,frequency?:string,count?:number){
 if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(rate)||rate<0||![1,3,6,12,24].includes(duration))throw new Error('Conditions du prêt invalides.');
 amount=Math.round(amount*100)/100;if(amount<=0)throw new Error('Montant inférieur au centime.');
 const selected=frequency || (duration===1?'weekly':duration===3?'monthly':'quarterly');
 if(!['weekly','monthly','quarterly'].includes(selected)||duration===1&&selected!=='weekly')throw new Error('Fréquence invalide.');
 const expected=duration===1?4:selected==='weekly'?Math.round(duration*4.345):selected==='monthly'?duration:duration/3;
 const installments=count??expected;
 if(!Number.isInteger(installments)||(duration===1?![4,5].includes(installments):installments!==expected))throw new Error('Nombre d’échéances invalide.');
 const totalRepayment=Math.round((amount*(1+rate/100)+Number.EPSILON)*100)/100;
 const installmentAmount=Math.round(totalRepayment/installments*100)/100;
 return {principal:amount,interestRate:rate,totalRepayment,repaymentFrequency:selected,installmentCount:installments,installmentAmount,lastInstallmentAmount:Math.round((totalRepayment-installmentAmount*(installments-1))*100)/100,guaranteeAmount:Math.round(amount*0.2*100)/100};
}
