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
import type { Currency } from '@/lib/types';

interface BitcoinExchangeFlowProps {
  direction: 'BUY_BTC' | 'SELL_BTC';
  /** Portefeuilles fiat de l'utilisateur. */
  fiatCurrencies: Currency[];
  btcBalance: number;
  onCompleted?: () => void;
}

/**
 * Achat / vente de Bitcoin depuis le web. Utilise la même route que
 * l'application mobile (POST /api/crypto/exchange) : taux officiels de la table
 * exchange_rates, PIN, verrouillage des soldes — tout est géré par le serveur.
 */
export function BitcoinExchangeFlow({
  direction,
  fiatCurrencies,
  btcBalance,
  onCompleted,
}: BitcoinExchangeFlowProps) {
  const { openAlert } = useAlertDialog();
  const isBuy = direction === 'BUY_BTC';

  const [currency, setCurrency] = useState(fiatCurrencies[0]?.code ?? 'USD');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      openAlert({ title: 'Montant invalide', description: 'Saisissez un montant supérieur à zéro.', variant: 'warning' });
      return;
    }

    if (!/^\d{4,8}$/.test(pin)) {
      openAlert({ title: 'PIN requis', description: 'Saisissez votre code PIN.', variant: 'warning' });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/crypto/exchange', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          currency,
          amount: numericAmount,
          pin,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        openAlert({
          title: isBuy ? 'Achat effectué' : 'Vente effectuée',
          description: isBuy
            ? `Vous avez acheté ${data.btcAmount} BTC pour ${data.fiatAmount} ${data.currency}. Réf. ${data.reference}`
            : `Vous avez vendu ${data.btcAmount} BTC pour ${data.fiatAmount} ${data.currency}. Réf. ${data.reference}`,
          variant: 'success',
        });

        setAmount('');
        setPin('');
        onCompleted?.();
        return;
      }

      openAlert({
        title: isBuy ? 'Achat impossible' : 'Vente impossible',
        description: data?.error || "L'opération a échoué.",
        variant: 'error',
      });
    } catch (error) {
      console.error('[BitcoinExchangeFlow]', error);

      openAlert({
        title: 'Erreur réseau',
        description: 'Impossible de joindre le serveur. Vérifiez votre historique avant de réessayer.',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-800 border-zinc-700">
      <CardHeader>
        <CardTitle>{isBuy ? 'Acheter du Bitcoin' : 'Vendre du Bitcoin'}</CardTitle>
        <CardDescription>
          {isBuy
            ? 'Payez depuis un de vos portefeuilles. Le taux appliqué est celui de CashPay.'
            : 'Les fonds sont crédités sur le portefeuille choisi. Le taux appliqué est celui de CashPay.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
          {!isBuy && (
            <p className="text-sm text-zinc-300">
              Solde disponible :{' '}
              <span className="font-semibold text-white">
                {Number(btcBalance || 0).toFixed(8)} BTC
              </span>
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {isBuy ? 'Payer avec' : 'Recevoir sur'}
            </p>

            <div className="space-y-2">
              {fiatCurrencies.map((item) => (
                <label
                  key={item.code}
                  className="flex items-center gap-3 rounded-lg border border-zinc-600 bg-zinc-700 p-3 text-white"
                >
                  <input
                    type="radio"
                    name={`exchange-currency-${direction}`}
                    value={item.code}
                    checked={currency === item.code}
                    onChange={() => setCurrency(item.code)}
                    disabled={isLoading}
                  />
                  <span>
                    {item.code} (Solde : {item.balance})
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`exchange-amount-${direction}`}>
              {isBuy ? `Montant à dépenser (${currency})` : 'Montant à vendre (BTC)'}
            </label>
            <Input
              id={`exchange-amount-${direction}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
              inputMode="decimal"
              placeholder="0.00"
              className="bg-zinc-700 border-zinc-600"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`exchange-pin-${direction}`}>
              Code PIN
            </label>
            <Input
              id={`exchange-pin-${direction}`}
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

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isBuy ? "Confirmer l'achat" : 'Confirmer la vente'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
