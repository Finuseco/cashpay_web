
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User } from '@/lib/types';
import { Copy, Eye, EyeOff, RefreshCcw, Code2, Smartphone, Wallet, ChevronsRight, Send } from 'lucide-react';
import { Label } from '../ui/label';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getAgentApiDetails, resetAgentApiSecret } from '@/lib/actions/agent.actions';
import { Skeleton } from '../ui/skeleton';

const ApiField = ({ label, value, type = "text", onCopy }: { label: string; value: string; type?: string, onCopy: () => void; }) => {
    const [isVisible, setIsVisible] = useState(type !== 'password');
    const displayValue = isVisible ? value : '●'.repeat(24);

    return (
        <div>
            <Label className="text-muted-foreground">{label}</Label>
            <div className="flex items-center gap-2 mt-1">
                <Input readOnly value={displayValue} className="font-mono bg-muted/50" />
                {type === 'password' && (
                    <Button variant="outline" size="icon" onClick={() => setIsVisible(!isVisible)}>
                        {isVisible ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                    </Button>
                )}
                <Button variant="outline" size="icon" onClick={onCopy}><Copy className="h-4 w-4" /></Button>
            </div>
        </div>
    );
};

const ApiExample = ({ apiKey, apiSecret }: { apiKey: string, apiSecret: string }) => {
    const credentials = isClient ? Buffer.from(`${apiKey}:${apiSecret}`).toString('base64') : '';
    const gatewayUrl = 'http://api.cashpay-all.com';
    
    const curlCommandSms = `curl -X POST '${gatewayUrl}/api/v1/agent/sms/send' \\\n-u '${apiKey}:${apiSecret}' \\\n-H 'Content-Type: application/json' \\\n-d '{\n  "to": "243851234567",\n  "message": "Hello from API!"\n}'`;
    const curlCommandAirtime = `curl -X POST '${gatewayUrl}/api/v1/agent/airtime/topup' \\\n-u '${apiKey}:${apiSecret}' \\\n-H 'Content-Type: application/json' \\\n-d '{\n  "phoneNumber": "243851234567",\n  "amount": 1.5,\n  "operator": "ORANGERDC"\n}'`;

    return (
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Code2/> Exemples d'Appels API</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label>Envoyer un SMS</Label>
                    <pre className="mt-2 w-full whitespace-pre-wrap rounded-md bg-zinc-900 p-4 text-xs text-white font-mono">{curlCommandSms}</pre>
                </div>
                <div>
                    <Label>Acheter du crédit</Label>
                    <pre className="mt-2 w-full whitespace-pre-wrap rounded-md bg-zinc-900 p-4 text-xs text-white font-mono">{curlCommandAirtime}</pre>
                </div>
            </CardContent>
        </Card>
    );
}

let isClient = false;

export function SmsApiClient() {
  const { t } = useTranslation();
  const { openAlert } = useAlertDialog();
  const [apiDetails, setApiDetails] = useState<{ apiKey: string; apiSecret: string; } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    isClient = true;
    const fetchDetails = async () => {
        setIsLoading(true);
        const agent = await getAuthenticatedUser();
        if (agent) {
            const details = await getAgentApiDetails(agent.id);
            setApiDetails(details);
        }
        setIsLoading(false);
    };
    fetchDetails();
  }, []);

  const handleCopy = (field: string, value: string) => {
    navigator.clipboard.writeText(value);
    openAlert({ variant: 'info', title: 'Copié', description: `${field} copié dans le presse-papiers.` });
  };
  
  const handleResetSecret = async () => {
      openAlert({
          variant: 'warning',
          title: "Réinitialiser la Clé Secrète ?",
          description: "Votre ancienne clé secrète ne fonctionnera plus. Vous devrez mettre à jour vos applications. Êtes-vous sûr ?",
          onClose: async (confirmed) => {
              if (confirmed === undefined || confirmed === false) return;
              
              const agent = await getAuthenticatedUser();
              if (agent) {
                  const result = await resetAgentApiSecret(agent.id);
                  if (result.success && result.newSecret) {
                      setApiDetails(prev => prev ? { ...prev, apiSecret: result.newSecret! } : null);
                      openAlert({ variant: 'success', title: "Clé Réinitialisée", description: "Votre clé secrète a été mise à jour." });
                  } else {
                      openAlert({ variant: 'error', title: "Erreur", description: "Impossible de réinitialiser la clé secrète." });
                  }
              }
          }
      });
  };

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">API Développeur</h1>
          <p className="text-muted-foreground">Intégrez les services CashPay dans vos propres applications.</p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Vos Identifiants API</CardTitle>
                <CardDescription>Utilisez ces clés pour authentifier vos requêtes. Ne partagez jamais votre clé secrète.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 {isLoading ? (
                    <div className="space-y-6">
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                    </div>
                 ) : apiDetails ? (
                    <>
                        <ApiField label="Clé API (API Key)" value={apiDetails.apiKey} onCopy={() => handleCopy('Clé API', apiDetails.apiKey)} />
                        <ApiField label="Clé Secrète (API Secret)" value={apiDetails.apiSecret} type="password" onCopy={() => handleCopy('Clé Secrète', apiDetails.apiSecret)} />
                    </>
                 ) : (
                    <p>Aucun détail d'API trouvé. Rechargez la page pour en générer.</p>
                 )}
            </CardContent>
            <CardFooter>
                 <Button variant="destructive" onClick={handleResetSecret} disabled={isLoading || !apiDetails}>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Réinitialiser la Clé Secrète
                </Button>
            </CardFooter>
        </Card>
        
        {apiDetails && <ApiExample apiKey={apiDetails.apiKey} apiSecret={apiDetails.apiSecret} />}
        
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Wallet/> API de Solde</CardTitle>
                    <CardDescription>Vérifiez le solde de vos portefeuilles.</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="mt-2 w-full whitespace-pre-wrap rounded-md bg-zinc-900 p-4 text-xs text-white font-mono">
                        {`GET ${gatewayUrl}/api/v1/agent/balance`}
                    </pre>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ChevronsRight/> API de Paiement</CardTitle>
                    <CardDescription>Permettez à vos clients de payer via CashPay.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <pre className="mt-2 w-full whitespace-pre-wrap rounded-md bg-zinc-900 p-4 text-xs text-white font-mono">
                        {`POST ${gatewayUrl}/api/v1/deposit/initiate`}
                    </pre>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
