

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { EvisaApplication, EvisaAppointment } from '@/lib/actions/evisa.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PlaneTakeoff, User, Calendar, Hash, RefreshCw, Download, FileText, Clock, Building } from 'lucide-react';
import { updateApplicationStatus, getAppointmentsForApplication, downloadEvisa } from '@/lib/actions/evisa.actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const statusStyles: { [key: string]: string } = {
    pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-500 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-500 border-red-500/30',
};

const DetailRow = ({ label, value }: { label: string; value: string | undefined }) => (
    <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">{value || 'N/A'}</span>
    </div>
);

const AppointmentDetails = ({ fluxId }: { fluxId: string }) => {
    const [appointments, setAppointments] = useState<EvisaAppointment[] | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAppointments = async () => {
            setIsLoading(true);
            const result = await getAppointmentsForApplication(fluxId);
            if (result.success && result.appointments) {
                setAppointments(result.appointments);
            } else {
                setAppointments([]);
            }
            setIsLoading(false);
        };
        fetchAppointments();
    }, [fluxId]);

    if (isLoading) {
        return <div className="p-2"><Loader2 className="h-4 w-4 animate-spin"/></div>
    }

    if (!appointments || appointments.length === 0) {
        return null; // No appointment section if none are found
    }

    return (
        <div className="mt-3 space-y-2 border-t pt-3">
             <h4 className="font-semibold text-sm">Détails du Rendez-vous</h4>
            {appointments.map(appt => (
                <div key={appt.appointmentId} className="text-sm p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-300">
                    <div className="flex items-center gap-2 mb-1"><Building className="h-4 w-4"/> <span className="font-bold">{appt.location}</span></div>
                    <div className="flex items-center gap-2"><Clock className="h-4 w-4"/> {format(new Date(appt.date), 'd MMMM yyyy', {locale: fr})} à {appt.time}</div>
                </div>
            ))}
        </div>
    );
}

export function EvisaHistoryClient({ initialApplications }: { initialApplications: EvisaApplication[] }) {
    const [applications, setApplications] = useState(initialApplications);
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const { toast } = useToast();

    const handleStatusUpdate = async (fluxId: string) => {
        setIsLoading(fluxId);
        const result = await updateApplicationStatus(fluxId);
        
        if (result.success && result.status) {
            setApplications(prev => prev.map(app => 
                app.flux_application_id === fluxId 
                ? { ...app, status: result.status!, visa_url: result.visaUrl || app.visa_url } 
                : app
            ));
            toast({ title: 'Statut mis à jour', description: `La demande est maintenant : ${result.status}` });
        } else {
            toast({ title: 'Erreur', description: result.error || 'Impossible de mettre à jour le statut.', variant: 'destructive' });
        }
        setIsLoading(null);
    };

    const handleDownload = async (applicationId: string, fileName: string) => {
        setIsLoading(`download-${applicationId}`);
        const result = await downloadEvisa(applicationId);
        if (result.success && result.fileData) {
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${result.fileData}`;
            link.download = result.fileName || `e-visa-${applicationId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: 'Téléchargement Démarré', description: 'Le document de votre e-visa est en cours de téléchargement.' });
        } else {
            toast({ title: 'Erreur de Téléchargement', description: result.error || 'Impossible de télécharger le document.', variant: 'destructive' });
        }
        setIsLoading(null);
    };

    if (applications.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    <PlaneTakeoff className="mx-auto h-12 w-12 mb-4" />
                    <h3 className="font-semibold text-lg">Aucune demande trouvée</h3>
                    <p>Vous n'avez pas encore soumis de demande d'e-visa.</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Accordion type="single" collapsible className="w-full space-y-4">
            {applications.map(app => (
                <AccordionItem value={app.id.toString()} key={app.id} className="border-b-0">
                     <Card>
                        <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:border-b">
                             <div className="flex justify-between items-center w-full">
                                <div className="text-left">
                                    <p className="font-bold">{app.destinationCountry}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(app.created_at), 'd MMMM yyyy', { locale: fr })}</p>
                                </div>
                                <Badge className={cn(statusStyles[app.status] || 'bg-gray-500')}>{app.status}</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-0">
                            <div className="space-y-3">
                                <DetailRow label="Bénéficiaire" value={`${app.firstName} ${app.lastName}`} />
                                <DetailRow label="Type de Visa" value={app.visaType} />
                                <DetailRow label="Date de Naissance" value={format(new Date(app.dateOfBirth), 'dd/MM/yyyy')} />
                                <DetailRow label="N° Passeport" value={app.passportNumber} />
                                <DetailRow label="Référence Flux" value={app.flux_application_id} />
                                <AppointmentDetails fluxId={app.flux_application_id} />
                            </div>
                             <CardFooter className="p-0 pt-4 flex justify-between">
                                <Button variant="ghost" size="sm" onClick={() => handleStatusUpdate(app.flux_application_id)} disabled={isLoading === app.flux_application_id}>
                                    {isLoading === app.flux_application_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>} 
                                    Mettre à jour
                                </Button>
                                {app.status === 'approved' && app.visa_url && (
                                     <Button size="sm" onClick={() => handleDownload(app.flux_application_id, `evisa-${app.destinationCountry}.pdf`)} disabled={isLoading === `download-${app.flux_application_id}`}>
                                        {isLoading === `download-${app.flux_application_id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                                        Télécharger l'E-Visa
                                    </Button>
                                )}
                                 {app.status === 'rejected' && (
                                     <Button variant="destructive" size="sm">
                                        <FileText className="mr-2 h-4 w-4"/> Voir le motif
                                    </Button>
                                )}
                            </CardFooter>
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
