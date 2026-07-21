'use client';

import { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getEventById, validateTicket } from '@/lib/actions/event.actions';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Calendar, Clock, MapPin, Ticket, User, Users, ArrowLeft, ScanLine, XCircle, CheckCircle, TicketCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { Event, Ticket as TicketInterface, TicketType } from '@/lib/actions/types';
import { QrScannerDialog } from '@/components/shared/qr-scanner-dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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


function EventManageClient({ initialEvent, userId }: { initialEvent: Event, userId: number }) {
    const router = useRouter();
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);
    const { toast } = useToast();

    if (initialEvent.ownerUserId !== userId) {
        return (
            <div className="text-center p-10">
                <p className="text-destructive">Accès non autorisé. Vous n'êtes pas l'organisateur de cet événement.</p>
            </div>
        );
    }
    
    const totalTickets = initialEvent.ticketTypes.reduce((sum: number, type: TicketType) => sum + type.quantity, 0);
    const totalSold = initialEvent.ticketTypes.reduce((sum: number, type: TicketType) => sum + type.sold, 0);
    const totalRevenue = initialEvent.ticketTypes.reduce((sum: number, type: TicketType) => sum + (type.sold * type.price), 0);

    const handleScan = async (ticketCode: string) => {
        setIsScannerOpen(false);
        toast({ title: 'Validation en cours...', description: 'Vérification du billet...' });
        
        const result = await validateTicket(initialEvent.id, ticketCode);
        setLastValidation(result);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Dialog open={!!lastValidation} onOpenChange={(open: boolean) => !open && setLastValidation(null)}>
                <DialogContent className="p-0 border-0 bg-transparent shadow-none">
                    <ValidationResultDialog result={lastValidation} onOpenChange={(open: boolean) => !open && setLastValidation(null)} />
                </DialogContent>
            </Dialog>

            <QrScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={handleScan} />

            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{initialEvent.name}</h1>
                    <p className="text-muted-foreground">Panneau de gestion</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Aperçu des Ventes</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
                     <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Billets Vendus</p>
                        <p className="text-3xl font-bold">{totalSold} / {totalTickets}</p>
                    </div>
                     <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Revenus Totaux ({initialEvent.currency})</p>
                        <p className="text-3xl font-bold">{totalRevenue.toFixed(2)}</p>
                    </div>
                     <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Validations</p>
                        <p className="text-3xl font-bold">0</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-primary text-primary-foreground">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <h2 className="text-2xl font-bold">Prêt pour le contrôle ?</h2>
                    <p className="mt-2 text-primary-foreground/80">Utilisez la caméra de votre appareil pour scanner et valider les billets à l'entrée.</p>
                    <Button variant="secondary" size="lg" className="mt-6" onClick={() => setIsScannerOpen(true)}>
                        <ScanLine className="mr-2 h-6 w-6"/> Ouvrir le Scanner
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Rapport des Ventes par Type de Billet</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {initialEvent.ticketTypes.map((ticketType: TicketType) => (
                            <div key={ticketType.id} className="p-3 border rounded-lg">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{ticketType.type}</p>
                                        <p className="text-sm text-muted-foreground">{ticketType.price.toFixed(2)} {initialEvent.currency} / billet</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{ticketType.sold} / {ticketType.quantity}</p>
                                        <p className="text-xs text-muted-foreground">vendus</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function EventManagePage({ params }: { params: { id: string } }) {
    const [event, setEvent] = useState<Event | null>(null);
    const [user, setUser] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const [fetchedEvent, fetchedUser] = await Promise.all([
                getEventById(params.id),
                getAuthenticatedUser()
            ]);
            setEvent(fetchedEvent || null);
            setUser(fetchedUser);
            setIsLoading(false);
        };
        fetchData();
    }, [params.id]);

    if (isLoading) {
        return <DashboardLayout><div>Chargement...</div></DashboardLayout>;
    }

    if (!event) {
        notFound();
    }
    
    if (!user) {
        // This case is handled by DashboardLayout which will redirect to login
        return <DashboardLayout><div>Redirection...</div></DashboardLayout>;
    }
    
    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <Suspense fallback={<div>Chargement des détails...</div>}>
                    <EventManageClient initialEvent={event} userId={user.id} />
                </Suspense>
            </main>
        </DashboardLayout>
    );
}
