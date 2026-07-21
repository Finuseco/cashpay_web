
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ScanLine, XCircle, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { QrScannerDialog } from '@/components/shared/qr-scanner-dialog';
import { validateTicket, deleteEvent } from '@/lib/actions/event.actions';
import type { Event, TicketType } from '@/lib/actions/types';
import { useTranslation } from 'react-i18next';

interface ValidationResult {
    success: boolean;
    message: string;
    ticket?: {
        ownerName: string;
        ticketType: string;
    };
}

const ValidationResultDialog = ({ result, onOpenChange }: { result: ValidationResult | null, onOpenChange: (open: boolean) => void }) => {
    if (!result) return null;

    const Icon = result.success ? CheckCircle : XCircle;
    const color = result.success ? 'text-green-500' : 'text-destructive';

    return (
        <Card className={cn("text-center p-6 border-2", result.success ? "border-green-500" : "border-destructive")}>
             <Icon className={cn("h-20 w-20 mx-auto", color)} />
             <h2 className={cn("text-3xl font-bold mt-4", color)}>{result.success ? 'VALIDE' : 'INVALIDE'}</h2>
             <p className="text-muted-foreground mt-2">{result.message}</p>
             {result.ticket && (
                 <div className="mt-4 text-left p-3 bg-muted rounded-lg">
                     <p><strong>Détenteur:</strong> {result.ticket.ownerName}</p>
                     <p><strong>Type:</strong> {result.ticket.ticketType}</p>
                 </div>
             )}
             <Button onClick={() => onOpenChange(false)} className="mt-6 w-full">Fermer</Button>
        </Card>
    );
};

export function EventManageClient({ initialEvent, userId }: { initialEvent: Event, userId: number }) {
    const router = useRouter();
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const { toast } = useToast();
    const { openAlert } = useAlertDialog();
    const { t } = useTranslation();
    
    const totalTickets = initialEvent.ticketTypes.reduce((sum: number, type: TicketType) => sum + type.quantity, 0);
    const totalSold = initialEvent.ticketTypes.reduce((sum: number, type: TicketType) => sum + type.sold, 0);
    const totalRevenue = initialEvent.ticketTypes.reduce((sum: number, type: TicketType) => sum + (type.sold * type.price), 0);
    const [validatedCount, setValidatedCount] = useState(initialEvent.validatedCount);

    const handleScan = async (ticketCode: string) => {
        setIsScannerOpen(false);
        toast({ title: 'Validation en cours...', description: 'Vérification du billet...' });
        
        const result = await validateTicket(initialEvent.id, ticketCode);
        setLastValidation(result);

        if (result.success) {
            setValidatedCount(prev => prev + 1);
        }
    };
    
    const handleDelete = () => {
        openAlert({
            title: "Supprimer l'événement ?",
            description: "Attention : Cette action supprimera définitivement l'événement, les types de billets et tous les billets déjà vendus. Voulez-vous continuer ?",
            variant: "warning",
            showCancel: true,
            confirmText: "Supprimer",
            cancelText: "Annuler",
            onClose: async (confirmed) => {
                if (confirmed) {
                    setIsDeleting(true);
                    try {
                        const result = await deleteEvent(initialEvent.id, userId);
                        if (result.success) {
                            toast({ title: "Supprimé", description: "L'événement a été supprimé avec succès." });
                            router.push('/events/manage');
                        } else {
                            openAlert({ title: "Erreur", description: result.error || "Échec de la suppression.", variant: "error" });
                        }
                    } catch (e) {
                        openAlert({ title: "Erreur", description: "Une erreur technique est survenue.", variant: "error" });
                    } finally {
                        setIsDeleting(false);
                    }
                }
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Dialog open={!!lastValidation} onOpenChange={(open: boolean) => !open && setLastValidation(null)}>
                <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-sm">
                    <ValidationResultDialog result={lastValidation} onOpenChange={(open: boolean) => !open && setLastValidation(null)} />
                </DialogContent>
            </Dialog>

            <QrScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={handleScan} />

            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{initialEvent.name}</h1>
                    <p className="text-muted-foreground">Gestion de l'événement</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Statistiques de Vente</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
                     <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Vendus</p>
                        <p className="text-3xl font-bold">{totalSold} / {totalTickets}</p>
                    </div>
                     <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Revenus ({initialEvent.currency})</p>
                        <p className="text-3xl font-bold">{totalRevenue.toFixed(2)}</p>
                    </div>
                     <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Validés à l'entrée</p>
                        <p className="text-3xl font-bold">{validatedCount}</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-primary text-primary-foreground">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <h2 className="text-2xl font-bold">Contrôle d'accès</h2>
                    <p className="mt-2 text-primary-foreground/80">Scannez les QR Codes des billets pour valider les entrées en temps réel.</p>
                    <Button variant="secondary" size="lg" className="mt-6" onClick={() => setIsScannerOpen(true)}>
                        <ScanLine className="mr-2 h-6 w-6"/> Ouvrir le Scanner
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Détail par catégorie</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {initialEvent.ticketTypes.map(ticketType => (
                            <div key={ticketType.id} className="p-3 border rounded-lg">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{ticketType.type}</p>
                                        <p className="text-sm text-muted-foreground">{ticketType.price.toFixed(2)} {initialEvent.currency} / unité</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{ticketType.sold} / {ticketType.quantity}</p>
                                        <p className="text-xs text-muted-foreground">billets vendus</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            
            <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle/> Zone de Danger</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                        <div>
                            <p className="font-semibold text-sm">Supprimer l'événement</p>
                            <p className="text-xs text-muted-foreground">Cette opération est irréversible et supprimera toutes les données de vente.</p>
                        </div>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Supprimer
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
