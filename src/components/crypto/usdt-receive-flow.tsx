'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

interface UsdtDeposit {
  id: number | string;
  amount: string | number;
  tx_hash: string;
  status: string;
  created_at: string;
}

interface UsdtReceiveFlowProps {
  /** Appelé quand de nouveaux dépôts peuvent avoir été crédités. */
  onRefreshed?: () => void;
}

/**
 * Réception d'USDT (TRC-20) : adresse personnelle + QR code + derniers dépôts.
 * Utilise les routes mobiles /api/v1/crypto/usdt-trc20/address et /deposits.
 */
export function UsdtReceiveFlow({ onRefreshed }: UsdtReceiveFlowProps) {
  const { openAlert } = useAlertDialog();

  const [address, setAddress] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deposits, setDeposits] = useState<UsdtDeposit[]>([]);

  const loadDeposits = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/crypto/usdt-trc20/deposits', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.success && Array.isArray(data.deposits)) {
        setDeposits(data.deposits.slice(0, 5));
      }
    } catch (error) {
      console.error('[UsdtReceiveFlow] Dépôts indisponibles :', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);

      try {
        const response = await fetch('/api/v1/crypto/usdt-trc20/address', {
          method: 'POST',
          credentials: 'same-origin',
        });
        const data = await response.json().catch(() => null);

        if (cancelled) return;

        if (response.ok && data?.success && data.address) {
          setAddress(String(data.address));
          setUnavailable(false);
          await loadDeposits();
        } else {
          setUnavailable(true);
        }
      } catch (error) {
        console.error('[UsdtReceiveFlow] Adresse indisponible :', error);
        if (!cancelled) setUnavailable(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [loadDeposits]);

  const handleCopy = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      openAlert({
        title: 'Adresse copiée',
        description: 'Votre adresse USDT (TRC-20) a été copiée.',
        variant: 'success',
      });
    } catch {
      openAlert({
        title: 'Erreur',
        description: "Impossible de copier l'adresse.",
        variant: 'error',
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDeposits();
    onRefreshed?.();
    setIsRefreshing(false);
  };

  return (
    <Card className="bg-zinc-800 border-zinc-700">
      <CardHeader>
        <CardTitle>Recevoir des USDT</CardTitle>
        <CardDescription>
          Réseau TRON (TRC-20). Les USDT envoyés à cette adresse sont crédités
          sur votre solde dès leur confirmation.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 p-4">
            <Skeleton className="h-40 w-40 rounded-lg" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : unavailable || !address ? (
          <div className="rounded-lg bg-zinc-900 p-4 text-center">
            <p className="text-sm text-zinc-300">
              La réception d’USDT n’est pas encore disponible pour votre compte.
              Réessayez dans quelques instants.
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG value={address} size={180} includeMargin />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-center">
                Votre adresse USDT (TRC-20)
              </p>

              <div className="rounded-lg bg-zinc-900 p-3">
                <p className="font-mono text-xs break-all text-center text-white">
                  {address}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleCopy}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copier l'adresse
              </Button>
            </div>

            <p className="text-xs text-center text-amber-300/90">
              Envoyez uniquement des USDT sur le réseau TRON (TRC-20). Un dépôt
              depuis un autre réseau (ERC-20, BEP-20…) ne pourra pas être crédité.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Derniers dépôts</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3 w-3" />
                  )}
                  Actualiser
                </Button>
              </div>

              {deposits.length === 0 ? (
                <p className="text-xs text-zinc-400">Aucun dépôt pour le moment.</p>
              ) : (
                <ul className="space-y-1">
                  {deposits.map((deposit) => (
                    <li
                      key={deposit.id}
                      className="flex items-center justify-between rounded-md bg-zinc-900 px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-white">
                        +{Number(deposit.amount).toFixed(2)} USDT
                      </span>
                      <span className="text-zinc-400">
                        {new Date(deposit.created_at).toLocaleString('fr-FR')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
