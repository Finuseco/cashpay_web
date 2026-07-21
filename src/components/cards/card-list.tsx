
'use client';

import { useState, useMemo } from "react";
import Link from 'next/link';
import { useTranslation } from "react-i18next";
import { VirtualCard } from "./virtual-card";
import { Button } from "@/components/ui/button";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { ArrowRightLeft, PowerOff, Power, Trash2, Settings, Hourglass, CheckCircle } from "lucide-react";
import { toggleCardStatus, requestCardDeletion } from "@/lib/actions/card.actions";
import type { Card, User, Currency } from "@/lib/types";
import { CardTransferForm } from "./card-transfer-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { CardRequest } from "@/lib/actions/card.actions";
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PhysicalCardRequest = ({ request }: { request: CardRequest }) => {
    return (
         <UICard>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                           <Hourglass className="h-5 w-5 text-amber-500" />
                            Demande de Carte Physique
                        </CardTitle>
                        <CardDescription>Demande du {new Date(request.created_at).toLocaleDateString()}</CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">{request.status}</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">Votre carte <span className="font-semibold">{request.brand.toUpperCase()} {request.currency}</span> est en cours de préparation. Veuillez vous présenter à votre agence CashPay pour la récupérer et l'activer.</p>
            </CardContent>
        </UICard>
    )
}

export function CardList({ cards, cardRequests, user, currencies }: { cards: Card[], cardRequests: CardRequest[], user: User, currencies: Currency[] }) {
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [openTransferDialog, setOpenTransferDialog] = useState(false);
  const [localCards, setLocalCards] = useState<Card[]>(cards);

  const handleToggleStatus = async (cardId: string, currentStatus: 'active' | 'inactive') => {
    const action = currentStatus === 'active' ? t('deactivate') : t('activate');
    const result = await toggleCardStatus(cardId, currentStatus === 'active' ? 'inactive' : 'active');

    if (result.success && result.card) {
      setLocalCards(prevCards => prevCards.map(c => c.id === cardId ? result.card! : c));
      openAlert({
        variant: "success",
        title: currentStatus === 'active' ? t('cardDeactivated') : t('cardActivated'),
        description: t('cardStatusToggleSuccess', { last4: result.card.last4, action: action }),
      });
    } else {
        openAlert({
            variant: "error",
            title: t('cardTransferErrorTitle'),
            description: result.error || t('cardStatusToggleError', { action: action }),
        });
    }
  }

  const handleDeleteRequest = (cardId: string) => {
    openAlert({
        title: t('cardDeleteRequestTitle'),
        description: t('cardDeleteRequestDescription'),
        variant: 'warning',
        showCancel: true,
        onClose: async (confirmed) => {
            if (!confirmed) return;
            const result = await requestCardDeletion(cardId, user.id);
            if (result.success) {
                setLocalCards(prev => prev.map(c => c.id === cardId ? {...c, status: 'pending_cancellation'} : c));
                openAlert({title: t('cardDeleteRequestSent'), description: t('cardDeleteRequestSentDescription'), variant: 'success'});
            } else {
                 openAlert({title: t('cardTransferErrorTitle'), description: result.error, variant: 'error'});
            }
        }
    })
  }
  
  if (cards.length === 0 && cardRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg min-h-[400px]">
        <h2 className="text-2xl font-semibold">{t('cardsNoCardsTitle')}</h2>
        <p className="text-muted-foreground mt-2">
          {t('cardsNoCardsDescription')}
        </p>
      </div>
    );
  }
  
  const getCurrencyForCard = (cardCurrency: string) => {
    return currencies.find(c => c.code === cardCurrency) || { balance: '0.00', symbol: '$' };
  }

  return (
    <>
    <Dialog open={openTransferDialog} onOpenChange={setOpenTransferDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('transferFundsTitle')}</DialogTitle>
          <DialogDescription>
            {t('transferFundsDescription')}
          </DialogDescription>
        </DialogHeader>
        <CardTransferForm user={user} cards={localCards} currencies={currencies} onComplete={() => setOpenTransferDialog(false)} />
      </DialogContent>
    </Dialog>

    <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
      {localCards.map((card, index) => {
          const associatedCurrency = getCurrencyForCard(card.currency);
          return (
            <div key={`card-${card.id}`} className="space-y-4">
                <VirtualCard card={card} balance={associatedCurrency.balance} symbol={associatedCurrency.symbol} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setOpenTransferDialog(true)}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        {t('transferFundsTitle')}
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/cards/${card.id}`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Gérer
                      </Link>
                    </Button>

                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(card.id, card.status as 'active' | 'inactive')} disabled={card.status === 'pending_cancellation'}>
                        {card.status === 'active' ? <PowerOff className="mr-2 h-4 w-4 text-destructive" /> : <Power className="mr-2 h-4 w-4 text-green-500" />}
                        {card.status === 'active' ? t('deactivate') : t('activate')}
                    </Button>
                    
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteRequest(card.id)}>
                        <Trash2 className="mr-2 h-4 w-4"/>
                        {t('delete')}
                    </Button>
                </div>
            </div>
          )
      })}
       {cardRequests.map((request, index) => (
            <PhysicalCardRequest key={`req-${request.id}`} request={request} />
        ))}
    </div>
    </>
  );
}
