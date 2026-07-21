

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getBillingAgreements, cancelBillingAgreement, type BillingAgreement } from '@/lib/actions/billing.actions';
import { getSavedUserCards, deleteLinkedAccount as deleteSavedCard, updateSavedCardDetails } from '@/lib/actions/card.actions';
import { Loader2, Repeat, Info, Trash2, CreditCard, RefreshCw } from 'lucide-react';
import type { User, SavedCard } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SavedCardItem = ({ card, onDelete, onSync }: { card: SavedCard; onDelete: (id: number) => void; onSync: (id: number) => void }) => {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncClick = async () => {
        setIsSyncing(true);
        await onSync(card.id);
        setIsSyncing(false);
    };

    const isVisa = card.card_brand === 'visa';

    return (
        <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
                <p className="font-semibold">{card.card_holder_name}</p>
                <p className="text-sm text-muted-foreground">{card.card_brand.toUpperCase()} •••• {card.last4}</p>
            </div>
            <div className="flex items-center gap-1">
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground" 
                    onClick={handleSyncClick} 
                    disabled={isSyncing || !isVisa} 
                    title={!isVisa ? "Non disponible pour cette carte" : "Vérifier les mises à jour de la carte"}
                >
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(card.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};


export function BillingAgreements({ user }: { user: User | null }) {
    const [agreements, setAgreements] = useState<BillingAgreement[]>([]);
    const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();

    useEffect(() => {
        const fetchAgreements = async () => {
            if (user) {
                setIsLoading(true);
                const [fetchedAgreements, fetchedCards] = await Promise.all([
                    getBillingAgreements(user.id),
                    getSavedUserCards(user.id)
                ]);
                setAgreements(fetchedAgreements);
                setSavedCards(fetchedCards);
                setIsLoading(false);
            } else {
                setIsLoading(false);
            }
        };
        fetchAgreements();
    }, [user]);

    const handleCancelAgreement = async (agreementId: string) => {
        openAlert({
            title: 'Confirmer l\'annulation',
            description: "Êtes-vous sûr de vouloir annuler cet accord de paiement automatique ? Cette action ne peut pas être annulée.",
            variant: 'warning',
            onClose: async (confirmed) => {
                if (confirmed === undefined || confirmed === false) return;

                const result = await cancelBillingAgreement(agreementId);
                if (result.success) {
                    setAgreements(prev => prev.map(a => a.id === agreementId ? { ...a, status: 'cancelled' } : a));
                    openAlert({ title: 'Succès', description: 'L\'accord de paiement a été annulé.', variant: 'success' });
                } else {
                    openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
                }
            }
        });
    };
    
    const handleDeleteCard = async (cardId: number) => {
        if (!user) return;
        openAlert({
            title: 'Supprimer cette carte ?',
            description: "Êtes-vous sûr de vouloir supprimer cette carte enregistrée ? Cette action est irréversible.",
            variant: 'warning',
            onClose: async (confirmed) => {
                if(confirmed) {
                    const result = await deleteSavedCard(user.id, cardId);
                    if (result.success) {
                        setSavedCards(result.accounts || []);
                    } else {
                        openAlert({ title: "Erreur", description: result.error, variant: 'error'});
                    }
                }
            }
        });
    };
    
    const handleSyncCard = async (cardId: number) => {
        if (!user) return;
        const result = await updateSavedCardDetails(cardId);
        if (result.success) {
            toast({ title: "Synchronisation Réussie", description: result.message, variant: "success" });
            const fetchedCards = await getSavedUserCards(user!.id);
            setSavedCards(fetchedCards);
        } else {
            openAlert({ title: "Synchronisation Échouée", description: result.message || result.error, variant: result.error ? "error" : "info" });
        }
    };


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CreditCard /> Cartes Enregistrées</CardTitle>
                    <CardDescription>
                        Gérez les cartes de crédit/débit que vous avez sauvegardées pour des paiements plus rapides.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {isLoading ? (
                         <div className="flex justify-center items-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : savedCards.length === 0 ? (
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Aucune carte enregistrée</AlertTitle>
                            <AlertDescription>
                                Vous pouvez sauvegarder une carte lors de votre prochain dépôt.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        savedCards.map(card => (
                           <SavedCardItem key={card.id} card={card} onDelete={handleDeleteCard} onSync={handleSyncCard} />
                        ))
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Repeat /> Paiements Automatiques</CardTitle>
                    <CardDescription>
                        Gérez les services que vous avez autorisés à débiter automatiquement votre compte CashPay pour des paiements récurrents.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : agreements.length === 0 ? (
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Aucun accord de paiement</AlertTitle>
                            <AlertDescription>
                                Vous n'avez autorisé aucune application ou service à effectuer des paiements automatiques.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Service / Marchand</TableHead>
                                    <TableHead>Date d'autorisation</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agreements.map((agreement) => (
                                    <TableRow key={agreement.id}>
                                        <TableCell className="font-medium">{agreement.merchantName}</TableCell>
                                        <TableCell>{format(new Date(agreement.createdAt), 'd MMMM yyyy', { locale: fr })}</TableCell>
                                        <TableCell>
                                            <Badge variant={agreement.status === 'active' ? 'default' : 'secondary'} className={agreement.status === 'active' ? 'bg-green-600' : ''}>
                                                {agreement.status === 'active' ? 'Actif' : 'Annulé'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {agreement.status === 'active' && (
                                                <Button variant="destructive" size="sm" onClick={() => handleCancelAgreement(agreement.id)}>
                                                    Déconnecter
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
