

'use client';


import type { LoanHistory } from '@/lib/actions/loan.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Handshake, Calendar, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from "react-i18next";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { repayLoan } from '@/lib/actions/loan.actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard } from 'lucide-react';

const currencySymbols: { [key: string]: string } = {
  USD: "$",
  EUR: "€",
  CDF: "FC",
};

export function LoanHistoryClient({ initialHistory }: { initialHistory: LoanHistory[] }) {
    const { t } = useTranslation();
    const router = useRouter();
    const [repayAmounts, setRepayAmounts] = useState<Record<number, string>>({});
    const [repayingLoanId, setRepayingLoanId] = useState<number | null>(null);
    const [repayError, setRepayError] = useState<Record<number, string>>({});
    const history = initialHistory;

    async function handleRepayment(loan: LoanHistory) {
        const amount = Number(repayAmounts[loan.id]);
        if (!Number.isFinite(amount) || amount <= 0) {
            setRepayError(prev => ({ ...prev, [loan.id]: 'Entrez un montant de remboursement valide.' }));
            return;
        }
        setRepayingLoanId(loan.id);
        setRepayError(prev => ({ ...prev, [loan.id]: '' }));
        const result = await repayLoan(Number((loan as any).user_id), Number(loan.id), amount);
        if (!result.success) {
            setRepayError(prev => ({ ...prev, [loan.id]: result.error || 'Remboursement impossible.' }));
            setRepayingLoanId(null);
            return;
        }
        setRepayAmounts(prev => ({ ...prev, [loan.id]: '' }));
        setRepayingLoanId(null);
        router.refresh();
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('loanHistoryTitle')}</h1>
                <p className="text-muted-foreground">{t('loanHistoryDescription')}</p>
            </div>
            {history.length > 0 ? (
                 <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={`loan-${history[0].id}`}>
                    {history.map(loan => {
                        const symbol = currencySymbols[loan.currency] || loan.currency;
                        const progress = (loan.repaid_amount / loan.amount) * 100;
                        return (
                            <AccordionItem value={`loan-${loan.id}`} key={loan.id} className="border-b-0">
                                <Card>
                                    <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:border-b">
                                        <div className="flex justify-between items-center w-full">
                                            <div className="text-left">
                                                <p className="font-bold">{t('loanItemTitle', { symbol, amount: loan.amount.toLocaleString() })}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('loanItemDateRange', { startDate: format(new Date(loan.start_date), 'd MMM yy', { locale: fr }), endDate: format(new Date(loan.end_date), 'd MMM yy', { locale: fr }) })}
                                                </p>
                                            </div>
                                            <Badge variant='outline' className='border-primary/30 bg-primary/5 text-primary'>{loan.status}</Badge>
                                        </div>
                                    </AccordionTrigger>
                                     <AccordionContent className="p-4 pt-0">
                                        <div className="space-y-4">
                                            <div>
                                                 <div className="flex justify-between items-baseline text-sm mb-1">
                                                    <span>{t('loanHistoryRepaid')}</span>
                                                    <span className="font-semibold">{symbol}{loan.repaid_amount.toLocaleString()} / {symbol}{loan.amount.toLocaleString()}</span>
                                                 </div>
                                                <Progress value={progress} />
                                            </div>
                                            {loan.status === 'approved' && Number(loan.remaining_balance) > 0.005 && (
                                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 mb-4">
                                                    <div className="flex items-center gap-2 font-semibold">
                                                        <CreditCard className="h-4 w-4" />
                                                        Rembourser maintenant
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Vous pouvez rembourser avant l’échéance, même partiellement. Le paiement est affecté d’abord à la première échéance non soldée, puis à la suivante si celle-ci est entièrement réglée.
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="number"
                                                            min="0.01"
                                                            step="0.01"
                                                            placeholder={`Montant en ${loan.currency}`}
                                                            value={repayAmounts[loan.id] || ''}
                                                            onChange={e => setRepayAmounts(prev => ({ ...prev, [loan.id]: e.target.value }))}
                                                            disabled={repayingLoanId === loan.id}
                                                        />
                                                        <Button onClick={() => handleRepayment(loan)} disabled={repayingLoanId === loan.id}>
                                                            {repayingLoanId === loan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rembourser'}
                                                        </Button>
                                                    </div>
                                                    {repayError[loan.id] && <p className="text-sm text-muted-foreground">{repayError[loan.id]}</p>}
                                                </div>
                                            )}
                                            {loan.schedule && loan.schedule.length > 0 && (
                                                <div>
                                                    <h4 className="font-semibold mb-2">{t('repaymentScheduleTitle', "Échéancier de remboursement")}</h4>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead><Calendar className="inline-block mr-2 h-4 w-4"/>{t('repaymentDueDate')}</TableHead>
                                                                <TableHead className="text-right">{t('tableHeaderAmount')}</TableHead>
                                                                <TableHead className="text-right">{t('repaymentStatus')}</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {loan.schedule.map((item, index) => (
                                                                <TableRow key={index}>
                                                                    <TableCell>{format(new Date(item.due_date), 'd MMMM yyyy', {locale: fr})}</TableCell>
                                                                    <TableCell className="text-right font-mono">{symbol}{item.remaining_amount.toFixed(2)}<span className="block text-xs text-muted-foreground">{t('tableHeaderAmount')}: {symbol}{item.amount.toFixed(2)}</span></TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Badge variant='outline' className={cn(item.status === 'paid' && 'border-primary/30 bg-primary/10 text-primary')}>
                                                                            {item.status === 'paid' ? <CheckCircle className="h-3 w-3 mr-1"/> : <Clock className="h-3 w-3 mr-1"/>}
                                                                            {item.status === 'paid' ? t('repaymentStatusPaid') : t('repaymentStatusDue')}
                                                                        </Badge>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                            {loan.repayments.length > 0 && (
                                                <div>
                                                <h4 className="font-semibold mt-4 mb-2">{t('transactionHistoryTitle', "Historique des transactions")}</h4>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>{t('tableHeaderDate')}</TableHead>
                                                            <TableHead>{t('tableHeaderType')}</TableHead>
                                                            <TableHead className="text-right">{t('tableHeaderAmount')}</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {loan.repayments.map(rep => (
                                                            <TableRow key={rep.id}>
                                                                <TableCell>{format(new Date(rep.payment_date), 'd MMM yyyy', { locale: fr })}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant='outline' className={cn(rep.type === 'penalty' && 'border-primary/30 bg-primary/5 text-primary')}>
                                                                        {rep.type === 'penalty' ? t('loanRepaymentTypePenalty') : t('loanRepaymentTypeRepayment')}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold text-foreground">
                                                                    {rep.type === 'repayment' ? '-' : '+'} {symbol}{rep.amount.toLocaleString()}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                                </div>
                                            )}
                                        </div>
                                     </AccordionContent>
                                </Card>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
            ) : (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        <Handshake className="mx-auto h-12 w-12 mb-4" />
                        <h3 className="font-semibold text-lg">{t('loanHistoryNoLoans')}</h3>
                        <p>{t('loanHistoryNoLoansDescription')}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

    