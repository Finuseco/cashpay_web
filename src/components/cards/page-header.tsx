
'use client';

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { User, Card as CardType, Currency } from "@/lib/types";
import { CreateCardDialog } from "./create-card-dialog";
import { CardList } from "./card-list";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { CardRequest } from "@/lib/actions/card.actions";

export function PageHeader({ user, cards, cardRequests, currencies }: { user: User, cards: CardType[], cardRequests: CardRequest[], currencies: Currency[] }) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { openAlert } = useAlertDialog();

  const handleCreateCardClick = () => {
    setIsDialogOpen(true);
  };

  return (
    <>
      <CreateCardDialog 
        user={user} 
        existingCards={cards} 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
      />
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t('cardsTitle')}</h1>
        <Button variant="gradient" onClick={handleCreateCardClick}>
            <Plus className="mr-2" />
            {t('cardsPurchaseButton')}
        </Button>
      </div>
      <CardList cards={cards} cardRequests={cardRequests} user={user} currencies={currencies} />
    </>
  );
}

    
