'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

export type SendCurrency = 'BTC' | 'USDT';

const CONFIG: Record<
  SendCurrency,
  {
    title: string;
    description: string;
    addressLabel: string;
    addressPlaceholder: string;
    decimals: number;
    unit: string;
    notice: string;
  }
> = {
  BTC: {
    title: 'Envoyer du Bitcoin',
    description:
      'Vers une adresse CashPay (instantané) ou vers une adresse Bitcoin externe.',
    addressLabel: 'Adresse Bitcoin du destinataire',
    addressPlaceholder: 'bc1…',
    decimals: 8,
    unit: 'BTC',
    notice:
      'Les frais configurés sont ajoutés au montant débité. Un transfert Bitcoin est définitif.',
  },
  USDT: {
    title: 'Envoyer des USDT',
    description:
      'Vers une adresse CashPay (instantané) ou vers une adresse TRON externe (réseau TRC-20).',
    addressLabel: 'Adresse TRON (TRC-20) du destinataire',
    addressPlaceholder: 'T…',
    decimals: 6,
    unit: 'USDT',
    notice:
      'Réseau TRC-20 uniquement : un envoi vers une adresse d’un autre réseau (ERC-20, BEP-20…) est perdu. Les frais configurés sont ajoutés au montant débité.',
  },
};

interface CryptoSendFlowProps {
  currency: SendCurrency;
  /** Solde disponible affiché au-dessus du formulaire. */
  balance: number;
  /** Appelé après un envoi accepté, pour rafraîchir les soldes. */
  onCompleted?: () => void;
}

/**
 * Envoi de BTC ou d'USDT depuis le web. Utilise exactement la même route que
 * l'application mobile (POST /api/v1/transfers) : PIN, frais, transfert interne
 * ou externe, tout est géré par le serveur.
 */
export function CryptoSendFlow({
  currency,
  balance,
  onCompleted,
}: CryptoSendFlowProps) {
  const config = CONFIG[currency];
  const { openAlert } = useAlertDialog();

  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const amountPattern = new RegExp(`^\\d+(\\.\\d{1,${config.decimals}})?$`);

  const validate = (): string | null => {
    if (address.trim().length < 20) {
      return 'Saisissez l’adresse complète du destinataire.';
    }

    if (!amountPattern.test(amount.trim()) || Number(amount) <= 0) {
      return `Montant invalide (${config.decimals} décimales maximum).`;
    }

    if (!/^\d{4,8}$/.test(pin)) {
      return 'Saisissez votre code PIN.';
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const problem = validate();

    if (problem) {
      openAlert({ title: 'Vérifiez le formulaire', description: problem, variant: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/transfers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency,
          amount: Number(amount),
          recipientAddress: address.trim(),
          pin,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        openAlert({
          title: 'Transfert effectué',
          description:
            data.message ||
            (data.txHash
              ? `Envoyé. Identifiant de transaction : ${data.txHash}`
              : 'Votre transfert a été effectué.'),
          variant: 'success',
        });

        setAddress('');
        setAmount('');
        setPin('');
        onCompleted?.();
        return;
      }

      if (response.status === 202 || data?.status === 'pending') {
        // Montant réservé, confirmation en cours : ne pas relancer.
        openAlert({
          title: 'Transfert en cours',
          description:
            data?.error ||
            'Votre transfert est en cours de confirmation. Ne le relancez pas.',
          variant: 'info',
        });

        setPin('');
        onCompleted?.();
        return;
      }

      openAlert({
        title: 'Transfert impossible',
        description: data?.error || 'Le transfert a échoué.',
        variant: 'error',
      });
    } catch (error) {
      console.error('[CryptoSendFlow]', error);

      openAlert({
        title: 'Erreur réseau',
        description:
          'Impossible de joindre le serveur. Vérifiez votre historique avant de réessayer.',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-800 border-zinc-700">
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
          <p className="text-sm text-zinc-300">
            Solde disponible :{' '}
            <span className="font-semibold text-white">
              {Number(balance || 0).toFixed(config.decimals)} {config.unit}
            </span>
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`send-address-${currency}`}>
              {config.addressLabel}
            </label>
            <Input
              id={`send-address-${currency}`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={config.addressPlaceholder}
              className="bg-zinc-700 border-zinc-600 font-mono text-xs"
              spellCheck={false}
              autoCapitalize="off"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`send-amount-${currency}`}>
              Montant ({config.unit})
            </label>
            <Input
              id={`send-amount-${currency}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
              inputMode="decimal"
              placeholder="0.00"
              className="bg-zinc-700 border-zinc-600"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`send-pin-${currency}`}>
              Code PIN
            </label>
            <Input
              id={`send-pin-${currency}`}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="bg-zinc-700 border-zinc-600 tracking-widest"
              disabled={isLoading}
            />
          </div>

          <p className="text-xs text-zinc-400">{config.notice}</p>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Envoyer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
