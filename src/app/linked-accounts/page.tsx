
'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Banknote, Plus, Trash2, Loader2, Link as LinkIcon, RefreshCw, FileText, User as UserIcon, FileDown } from "lucide-react";
import type { User, LinkedBankAccount } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLinkedBankAccounts, deleteLinkedAccount, generateConnectUrl, getMiniStatementForAccount, syncBankAccountBalance, getOfficialStatementsForAccount } from '@/lib/actions/open-banking.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DataDialog = ({ 
    open, 
    onOpenChange, 
    transactions, 
    statements, 
    isLoading 
}: { 
    open: boolean, 
    onOpenChange: (open: boolean) => void, 
    transactions: any[] | null, 
    statements: any[] | null,
    isLoading: boolean 
}) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800 text-white">
            <DialogHeader>
                <DialogTitle>Historique & Documents</DialogTitle>
                <DialogDescription className="text-zinc-400">Consultez vos transactions et téléchargez vos relevés officiels.</DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="transactions" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="statements">Relevés Officiels</TabsTrigger>
                </TabsList>

                <TabsContent value="transactions" className="max-h-[50vh] overflow-y-auto pt-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : transactions && transactions.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800">
                                    <TableHead className="text-zinc-400">Date</TableHead>
                                    <TableHead className="text-zinc-400">Description</TableHead>
                                    <TableHead className="text-right text-zinc-400">Montant</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map((tx: any, index: number) => (
                                    <TableRow key={index} className="border-zinc-800">
                                        <TableCell className="text-xs">{format(new Date(tx.transactionDate || tx.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell className="text-sm">{tx.narration || tx.description}</TableCell>
                                        <TableCell className={`text-right font-bold ${tx.transactionType === 'DEBIT' ? 'text-red-400' : 'text-green-400'}`}>
                                            {tx.transactionType === 'DEBIT' ? '-' : '+'} {parseFloat(tx.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                            <span className="text-[10px] ml-1 opacity-70">{tx.currency}</span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-center text-muted-foreground p-8">Aucune transaction trouvée.</p>
                    )}
                </TabsContent>

                <TabsContent value="statements" className="max-h-[50vh] overflow-y-auto pt-4">
                    {isLoading ? (
                         <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : statements && statements.length > 0 ? (
                        <div className="space-y-2">
                            {statements.map((st: any) => (
                                <div key={st.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/50">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-5 w-5 text-primary" />
                                        <div>
                                            <p className="text-sm font-bold">{st.period}</p>
                                            <p className="text-[10px] text-zinc-500">Généré le {format(new Date(st.date), 'dd/MM/yyyy')}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" asChild>
                                        <a href={st.downloadUrl} target="_blank"><FileDown className="h-4 w-4 mr-2"/> PDF</a>
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground p-8">Aucun relevé officiel disponible pour ce compte.</p>
                    )}
                </TabsContent>
            </Tabs>
        </DialogContent>
    </Dialog>
);

const AccountItem = ({ account, onDelete, onRefresh, onViewData }: { account: LinkedBankAccount; onDelete: (id: number) => void; onRefresh: (id: number) => void; onViewData: (id: number) => void }) => {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh(account.id);
        setIsRefreshing(false);
    };

    return (
        <div className="flex items-center justify-between p-4 bg-background rounded-xl border shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Banknote className="h-5 w-5 text-primary" />
                 </div>
                <div>
                    <div className="flex items-center gap-2">
                        <p className="font-bold">{account.institutionName}</p>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4 border-primary/30 text-primary">Souverain</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{account.accountType} •••• {account.accountNumberMask}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <UserIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase">{account.accountHolderName}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 text-right">
                <div className="mr-2">
                    <p className="font-black text-sm">{account.balance?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {account.currency}</p>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Solde Réel</p>
                </div>
                 <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleRefresh} disabled={isRefreshing} title="Synchroniser">
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")}/>
                </Button>
                 <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={() => onViewData(account.id)} title="Transactions & Relevés">
                    <FileText className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-red-50" onClick={() => onDelete(account.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
        </div>
    )
};

export default function LinkedAccountsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [accounts, setAccounts] = useState<LinkedBankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLinking, setIsLinking] = useState(false);
    const [isConnectOpen, setIsConnectOpen] = useState(false);
    const [connectUrl, setConnectUrl] = useState<string | null>(null);
    const { openAlert } = useAlertDialog();

    const [isDataLoading, setIsDataLoading] = useState(false);
    const [transactionData, setTransactionData] = useState<any[] | null>(null);
    const [statementData, setStatementData] = useState<any[] | null>(null);
    const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        const fetchedUser = await getAuthenticatedUser();
        setUser(fetchedUser);
        if (fetchedUser) {
            const fetchedAccounts = await getLinkedBankAccounts(fetchedUser.id);
            setAccounts(fetchedAccounts);
        }
        setIsLoading(false);
    };

    const handleSync = async (accountId: number) => {
        const result = await syncBankAccountBalance(accountId);
        if (result.success) {
            setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, balance: result.balance, accountHolderName: result.accountHolderName || a.accountHolderName } : a));
        }
    };

    const handleDelete = (accountId: number) => {
        if (!user) return;
        openAlert({
            title: 'Révoquer l\'accès ?',
            description: "La synchronisation sera interrompue et CashPay ne pourra plus consulter ce compte bancaire.",
            variant: 'warning',
            showCancel: true,
            onClose: async (confirmed) => {
                if(confirmed) {
                    const result = await deleteLinkedAccount(user.id, accountId);
                    if (result.success) {
                        setAccounts(prev => prev.filter(a => a.id !== accountId));
                    }
                }
            }
        });
    };
    
    const handleLinkAccount = async () => {
        if (!user) return;
        setIsLinking(true);
        const result = await generateConnectUrl(user.id);
        if (result.success && result.linkUrl) {
          setConnectUrl(result.linkUrl);
          setIsConnectOpen(true);
        } else {
          openAlert({ title: 'Erreur', description: 'Impossible de joindre le portail bancaire.', variant: 'error'});
        }
        setIsLinking(false);
    };

    const handleViewData = async (accountId: number) => {
        setIsDataLoading(true);
        setIsDataDialogOpen(true);
        setTransactionData(null);
        setStatementData(null);
        
        const [txResult, stResult] = await Promise.all([
            getMiniStatementForAccount(accountId),
            getOfficialStatementsForAccount(accountId)
        ]);
        
        if (txResult.success) setTransactionData(txResult.transactions || []);
        if (stResult.success) setStatementData(stResult.statements || []);
        
        if (!txResult.success && !stResult.success) {
            openAlert({ title: "Erreur", description: "Impossible de récupérer les données bancaires.", variant: 'error' });
            setIsDataDialogOpen(false);
        }
        
        setIsDataLoading(false);
    };

    return (
        <>
        <DashboardLayout pageTitleKey="Open Banking">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Comptes Bancaires Connectés</CardTitle>
                            <CardDescription>Gérez vos comptes externes synchronisés via l'infrastructure Sahl Financial.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isLoading ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                            ) : accounts.length > 0 ? (
                                accounts.map(acc => <AccountItem key={acc.id} account={acc} onDelete={handleDelete} onRefresh={handleSync} onViewData={handleViewData} />)
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed rounded-xl">
                                    <LinkIcon className="h-10 w-10 mx-auto text-muted-foreground opacity-20 mb-2" />
                                    <p className="text-sm text-muted-foreground">Aucun compte bancaire lié pour le moment.</p>
                                </div>
                            )}
                            
                             <Button variant="outline" className="w-full h-12 border-primary text-primary hover:bg-primary/5 font-bold" onClick={handleLinkAccount} disabled={isLinking}>
                                {isLinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Plus className="mr-2 h-4 w-4" />} 
                                Connecter un nouveau compte via Sahl
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </DashboardLayout>

         <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
          <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 overflow-hidden">
             <DialogHeader className="p-6 pb-0">
                 <DialogTitle>Portail Bancaire Sécurisé</DialogTitle>
                 <DialogDescription>Authentifiez-vous auprès de votre établissement pour autoriser la lecture.</DialogDescription>
             </DialogHeader>
             <div className="flex-1 px-6 pb-6 mt-4">
                {connectUrl && (
                     <iframe src={connectUrl} width="100%" height="100%" className="border rounded-xl shadow-inner bg-white" allow="fullscreen" />
                )}
             </div>
          </DialogContent>
        </Dialog>

        <DataDialog 
            open={isDataDialogOpen} 
            onOpenChange={setIsDataDialogOpen} 
            transactions={transactionData} 
            statements={statementData}
            isLoading={isDataLoading}
        />
        </>
    )
}
