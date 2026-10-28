'use client';

import { useState, useRef, useEffect } from 'react';
import type { EventTicket } from '@/lib/actions/event.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from '@/components/ui/button';
import { Ticket, Calendar, Clock, MapPin, QrCode, Printer, Share2, Video, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import jsPDF from 'jspdf';
import { getReceiptLogoBase64 } from '@/lib/actions/transaction.actions';


const E_Ticket = ({ ticket, event }: { ticket: EventTicket['tickets'][0], event: Omit<EventTicket, 'tickets'> }) => {
    const pdfRef = useRef<HTMLDivElement>(null);
    const { openAlert } = useAlertDialog();
    const [logoBase64, setLogoBase64] = useState<string | null>(null);

    useEffect(() => {
        getReceiptLogoBase64().then(setLogoBase64);
    }, []);

    const isZoomEvent = event.eventType === 'zoom' || event.eventType === 'onchat';
    const onlineLabel = event.eventType === 'onchat' ? 'OnChat Meet' : 'Zoom (billet existant)';

    const handleSharePdf = async () => {
        const element = pdfRef.current;
        if (!element) return;

        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(element, { scale: 3, useCORS: true });
        const imgData = canvas.toDataURL('image/png');

        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasAspectRatio = canvas.width / canvas.height;

        let finalWidth = pdfWidth - 20;
        let finalHeight = finalWidth / canvasAspectRatio;

        if (finalHeight > pdfHeight - 20) {
            finalHeight = pdfHeight - 20;
            finalWidth = finalHeight * canvasAspectRatio;
        }

        pdf.addImage(imgData, 'PNG', (pdfWidth - finalWidth) / 2, 10, finalWidth, finalHeight);
        pdf.save(`billet-cashpay-${ticket.ticketCode.substring(0,10)}.pdf`);
    };

    return (
        <>
            <div className="hidden">
                 <div ref={pdfRef} className="p-4 bg-white text-black font-sans" style={{width: '210mm'}}>
                    <div className="text-center pb-2 border-b border-black flex justify-between items-center">
                       {logoBase64 && <img src={logoBase64} alt="CashPay Logo" style={{ width: '50mm' }} />}
                        <div>
                            <h3 className="font-bold text-lg">{event.eventName}</h3>
                            <p className="text-sm">{format(new Date(event.date), "EEEE d MMM yyyy 'à' HH:mm", { locale: fr })}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 items-center py-4">
                        <div className="text-center">
                            {isZoomEvent ? (
                                <div className="p-10 border-2 border-zinc-200 rounded-xl">
                                    <Video className="h-20 w-20 mx-auto text-zinc-400 mb-2"/>
                                    <p className="text-sm font-bold">ÉVÉNEMENT EN LIGNE</p>
                                </div>
                            ) : (
                                <>
                                    <QRCodeSVG value={ticket.ticketCode} size={200} className="mx-auto" />
                                    <p className="font-mono text-sm mt-2 tracking-widest">{ticket.ticketCode}</p>
                                </>
                            )}
                        </div>
                        <div className="text-sm space-y-2 border-l border-black pl-4">
                            <h4 className="font-bold text-xl mb-4 uppercase">{isZoomEvent ? 'Accès Webinaire' : 'Billet Entrée'}</h4>
                            <p><strong>Événement:</strong> {event.eventName}</p>
                            <p><strong>Lieu:</strong> {isZoomEvent ? onlineLabel : event.location}</p>
                            <p><strong>Type:</strong> {ticket.ticketType}</p>
                            <p><strong>Détenteur:</strong> {ticket.ownerName}</p>
                            <p><strong>Statut:</strong> <span className="font-bold">{ticket.status}</span></p>
                        </div>
                    </div>
                </div>
            </div>

            <DialogHeader>
                <DialogTitle>{isZoomEvent ? 'Accès Vidéo' : 'Billet Entrée'}</DialogTitle>
                <DialogDescription>
                    {isZoomEvent ? "Utilisez le lien ci-dessous pour rejoindre la conférence." : "Présentez ce QR code à l'entrée."}
                </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-background rounded-lg border">
                <div className="text-center pb-4 border-b">
                    <h3 className="font-bold text-lg">{event.eventName}</h3>
                    <p className="text-sm text-muted-foreground">{isZoomEvent ? onlineLabel : event.location}</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(event.date), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
                </div>
                <div className="py-4 text-center">
                     {isZoomEvent ? (
                         <div className="p-6 bg-zinc-50 rounded-lg border-2 border-dashed flex flex-col items-center gap-3">
                            <div className="h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                                <Video className="h-8 w-8 text-blue-600"/>
                            </div>
                            <p className="text-sm font-semibold">Votre code personnel de participation : {ticket.ticketCode}</p>
                         </div>
                     ) : (
                        <>
                            <div className="bg-white p-2 rounded-lg inline-block">
                                <QRCodeSVG value={ticket.ticketCode} size={180} bgColor={"#FFFFFF"} fgColor={"#000000"} />
                            </div>
                            <p className="font-mono text-xs mt-2 text-muted-foreground tracking-widest">{ticket.ticketCode}</p>
                        </>
                     )}
                </div>
                <div className="pt-4 border-t text-sm space-y-1">
                    <p><strong>Billet :</strong> {ticket.ticketType}</p>
                    <p><strong>Statut :</strong> <span className="font-bold text-green-600 uppercase">{ticket.status}</span></p>
                </div>
            </div>

             <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                {(ticket.onchatJoinUrl || ticket.zoomJoinUrl) ? (
                    <Button asChild className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg font-bold shadow-lg">
                        <a href={ticket.onchatJoinUrl || ticket.zoomJoinUrl || undefined} target={ticket.onchatJoinUrl ? undefined : "_blank"} rel="noopener noreferrer">
                            <Video className="mr-2"/> Rejoindre maintenant
                        </a>
                    </Button>
                ) : (
                    <Button variant="outline" className="w-full" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4"/>Imprimer</Button>
                )}
                <Button variant="secondary" className="w-full" onClick={handleSharePdf}><Share2 className="mr-2 h-4 w-4"/>PDF</Button>
            </DialogFooter>
        </>
    )
}

export function MyTicketsClient({ ticketsByEvent }: { ticketsByEvent: EventTicket[] }) {
    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Mes Billets & Accès</h1>
                    <p className="text-muted-foreground">Retrouvez ici vos accès pour les événements physiques et webinaires.</p>
                </div>

                {ticketsByEvent.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full" defaultValue={`item-${ticketsByEvent[0].eventId}`}>
                        {ticketsByEvent.map((event) => (
                            <AccordionItem value={`item-${event.eventId}`} key={event.eventId}>
                                <AccordionTrigger>
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="relative h-16 w-16 shrink-0">
                                            <Image src={event.imageUrl || 'https://placehold.co/100x100.png'} alt={event.eventName} fill className="rounded-lg object-cover aspect-square"/>
                                            {(event.eventType === 'zoom' || event.eventType === 'onchat') && (
                                                <div className="absolute -top-1 -right-1 bg-blue-600 rounded-full p-1 border-2 border-white shadow-sm">
                                                    <Video className="h-3 w-3 text-white"/>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold">{event.eventName}</h3>
                                            <p className="text-sm text-muted-foreground">{format(new Date(event.date), "d MMMM yyyy", { locale: fr })}</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                                        {event.tickets.map(ticket => (
                                             <Dialog key={ticket.id}>
                                                <DialogTrigger asChild>
                                                    <div className="flex items-center justify-between p-3 bg-card rounded-md cursor-pointer hover:bg-accent border border-zinc-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                <Ticket className="h-4 w-4 text-primary"/>
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-sm">{ticket.ticketType}</p>
                                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">{(event.eventType === 'zoom' || event.eventType === 'onchat') ? 'Accès Digital' : 'Entrée Physique'}</p>
                                                            </div>
                                                        </div>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs">Détails</Button>
                                                    </div>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-xs p-4">
                                                    <E_Ticket ticket={ticket} event={event}/>
                                                </DialogContent>
                                            </Dialog>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <Card className="text-center py-16">
                        <CardContent>
                            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                <Ticket className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-semibold">Aucun billet trouvé</h3>
                            <p className="text-muted-foreground mt-2">Vous n'avez pas encore acheté de billets.</p>
                            <Button asChild className="mt-6 font-bold" variant="gradient">
                                <Link href="/events">Découvrir les événements</Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}
