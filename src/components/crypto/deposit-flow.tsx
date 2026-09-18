'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Loader2 } from 'lucide-react';
import { getUserCryptoAddresses } from '@/lib/actions/crypto.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

interface DepositFlowProps {
  user: User;
}

export function DepositFlow({ user }: DepositFlowProps) {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const { openAlert } = useAlertDialog();

  useEffect(() => {
    let cancelled = false;

    const loadBitcoinAddress = async () => {
      setIsLoading(true);

      try {
        const addresses = await getUserCryptoAddresses(user.id);
        const bitcoinAddress = addresses.BTC || '';

        if (!cancelled) {
          setAddress(bitcoinAddress);
        }
      } catch (error) {
        console.error(
          '[DepositFlow] Failed to load Bitcoin address:',
          error
        );

        if (!cancelled) {
          openAlert({
            title: 'Erreur',
            description:
              "Impossible de récupérer votre adresse Bitcoin pour le moment.",
            variant: 'error',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadBitcoinAddress();

    return () => {
      cancelled = true;
    };
  }, [user.id, openAlert]);

  const handleCopyAddress = async () => {
    if (!address) return;

    setCopying(true);

    try {
      await navigator.clipboard.writeText(address);

      openAlert({
        title: 'Adresse copiée',
        description: "Votre adresse Bitcoin a été copiée.",
        variant: 'success',
      });
    } catch (error) {
      console.error(
        '[DepositFlow] Failed to copy Bitcoin address:',
        error
      );

      openAlert({
        title: 'Erreur',
        description:
          "Impossible de copier l'adresse Bitcoin.",
        variant: 'error',
      });
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card className="bg-zinc-800 border-zinc-700">
      <CardHeader>
        <CardTitle>Recevoir du Bitcoin</CardTitle>
        <CardDescription>
          Utilisez cette adresse pour recevoir du Bitcoin depuis un
          portefeuille ou une plateforme externe.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 p-4">
            <Skeleton className="h-40 w-40 rounded-lg" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : address ? (
          <>
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG
                  value={address}
                  size={180}
                  includeMargin
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-center">
                Votre adresse Bitcoin
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
                onClick={handleCopyAddress}
                disabled={copying}
              >
                {copying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copier l'adresse
              </Button>
            </div>

            <p className="text-xs text-center text-zinc-400">
              Envoyez uniquement du Bitcoin (BTC) à cette adresse.
              Les transactions reçues seront détectées à partir du
              réseau Bitcoin.
            </p>
          </>
        ) : (
          <div className="rounded-lg bg-zinc-900 p-4 text-center">
            <p className="text-sm text-zinc-300">
              Aucune adresse Bitcoin disponible.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
