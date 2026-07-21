
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { generateConnectUrl, getLinkedBankAccounts, syncBankAccountBalance } from '@/lib/actions/open-banking.actions';
import type { User, LinkedBankAccount } from '@/lib/types';
import { Loader2, Link as LinkIcon, RefreshCw, Building2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LinkBankAccount({ user }: { user: User }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedBankAccount[]>([]);
  const { openAlert } = useAlertDialog();

  useEffect(() => {
    const fetchAccounts = async () => {
        const accounts = await getLinkedBankAccounts(user.id);
        setLinkedAccounts(accounts);
    };
    fetchAccounts();
  }, [user.id]);

  const handleLinkAccount = async () => {
    setIsLoading(true);
    const result = await generateConnectUrl(user.id);
    if (result.success && result.linkUrl) {
      setConnectUrl(result.linkUrl);
      setIsDialogOpen(true);
    } else {
      openAlert({ title: 'Erreur', description: 'Impossible de se connecter au service bancaire.', variant: 'error' });
    }
    setIsLoading(false);
  };

  const handleSync = async (accountId: number) => {
    setIsSyncing(accountId);
    const result = await syncBankAccountBalance(accountId);
    if (result.success) {
        const updated = await getLinkedBankAccounts(user.id);
        setLinkedAccounts(updated);
    }
    setIsSyncing(null);
  };

  return (
    <>
      <div className="space-y-3">
        {linkedAccounts.map(account => (
            <Card key={account.id} className="border-none shadow-sm bg-card">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Compte Bancaire</p>
                            <p className="font-mono text-sm">•••• {account.accountNumberMask}</p>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                        <div>
                            <p className="text-xl font-black text-foreground">
                                {account.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })} 
                                <span className="text-xs font-medium ml-1">{account.currency}</span>
                            </p>
                        </div>
                        <Button 
                            variant="secondary" 
                            size="icon" 
                            className="h-9 w-9 rounded-full" 
                            onClick={() => handleSync(account.id)} 
                            disabled={isSyncing === account.id}
                        >
                            <RefreshCw className={cn("h-4 w-4", isSyncing === account.id && "animate-spin")} />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        ))}

        <Button 
            onClick={handleLinkAccount} 
            disabled={isLoading} 
            variant="outline" 
            className="w-full h-12 border-dashed border-zinc-300 bg-transparent hover:bg-muted text-zinc-500"
        >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
            Lier un nouveau compte bancaire
        </Button>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 overflow-hidden">
             <DialogHeader className="p-6 pb-0">
                 <DialogTitle>Connexion Bancaire</DialogTitle>
                 <DialogDescription>Veuillez vous authentifier sur le portail sécurisé de votre banque.</DialogDescription>
             </DialogHeader>
             <div className="flex-1 px-6 pb-6 mt-4">
                {connectUrl && (
                     <iframe src={connectUrl} width="100%" height="100%" className="border rounded-xl shadow-inner bg-white" allow="fullscreen" />
                )}
             </div>
          </DialogContent>
      </Dialog>
    </>
  );
}
