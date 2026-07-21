

'use client';

import { useState } from 'react';
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

const currencySymbols: { [key: string]: string } = {
  USD: "$",
  EUR: "€",
  CDF: "FC",
};

export function LoanHistoryClient({ initialHistory }: { initialHistory: LoanHistory[] }) {
    const { t } = useTranslation();
    const [history, setHistory] = useState(initialHistory);

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
                                            <Badge variant={loan.status === 'approved' ? 'default' : 'secondary'}>{loan.status}</Badge>
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
                                                 {loan.monthly_payment && (
                                                    <div className="text-center text-xs text-muted-foreground mt-2">
                                                        Échéance mensuelle: <span className="font-semibold text-foreground">{symbol}{loan.monthly_payment.toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {loan.schedule && loan.schedule.length > 0 && (
                                                <div>
                                                    <h4 className="font-semibold mb-2">{t('repaymentScheduleTitle')}</h4>
                                                    <Table>
                                                        <TableHeader><TableRow><TableHead><Calendar className="inline-block mr-2 h-4 w-4"/>{t('repaymentDueDate')}</TableHead><TableHead className="text-right">{t('tableHeaderAmount')}</TableHead><TableHead className="text-right">{t('repaymentStatus')}</TableHead></TableRow></TableHeader>
                                                        <TableBody>
                                                            {loan.schedule.map((item, index) => (
                                                                <TableRow key={index}>
                                                                    <TableCell>{format(new Date(item.dueDate), 'd MMMM yyyy', {locale: fr})}</TableCell>
                                                                    <TableCell className="text-right font-mono">{symbol}{item.amount.toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Badge variant={item.status === 'paid' ? 'default' : 'outline'} className={cn(item.status === 'paid' && 'bg-green-500/80')}>
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
                                                <h4 className="font-semibold mt-4 mb-2">{t('transactionHistoryTitle')}</h4>
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
                                                                    <Badge variant={rep.type === 'penalty' ? 'destructive' : 'outline'}>
                                                                        {rep.type === 'penalty' ? t('loanRepaymentTypePenalty') : t('loanRepaymentTypeRepayment')}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className={cn("text-right font-semibold", rep.type === 'penalty' ? 'text-destructive' : 'text-green-600')}>
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

    

