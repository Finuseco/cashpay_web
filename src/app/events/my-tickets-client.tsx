
'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { EventTicket } from '@/lib/actions/event.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from '@/components/ui/button';
import { Ticket, Calendar, Clock, MapPin, QrCode, Printer, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';

const E_Ticket = ({ ticket, event }: { ticket: EventTicket['tickets'][0], event: Omit<EventTicket, 'tickets'> }) => {
    return (
        <div className="p-4 bg-background rounded-lg border">
            <div className="text-center pb-4 border-b">
                <h3 className="font-bold text-lg">{event.eventName}</h3>
                <p className="text-sm text-muted-foreground">{event.location}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(event.date), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
            </div>
            <div className="py-4 text-center">
                 <QRCodeSVG value={ticket.ticketCode} size={180} className="mx-auto" />
                 <p className="font-mono text-xs mt-2 text-muted-foreground tracking-widest">{ticket.ticketCode}</p>
            </div>
            <div className="pt-4 border-t text-sm">
                <p><strong>Billet :</strong> {ticket.ticketType}</p>
                <p><strong>Acheteur :</strong> {ticket.ownerName}</p>
            </div>
        </div>
    )
}

export function MyTicketsClient({ ticketsByEvent }: { ticketsByEvent: EventTicket[] }) {
    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Mes Billets</h1>
                    <p className="text-muted-foreground">Retrouvez ici tous les billets que vous avez achetés.</p>
                </div>
                
                {ticketsByEvent.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full" defaultValue={`item-${ticketsByEvent[0].eventId}`}>
                        {ticketsByEvent.map((event) => (
                            <AccordionItem value={`item-${event.eventId}`} key={event.eventId}>
                                <AccordionTrigger>
                                    <div className="flex items-center gap-4 text-left">
                                        <Image src={event.imageUrl || 'https://placehold.co/100x100.png'} alt={event.eventName} width={64} height={64} className="rounded-lg object-cover aspect-square"/>
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
                                                    <div className="flex items-center justify-between p-3 bg-card rounded-md cursor-pointer hover:bg-accent">
                                                        <div className="flex items-center gap-3">
                                                            <Ticket className="h-5 w-5 text-primary"/>
                                                            <div>
                                                                <p className="font-semibold">{ticket.ticketType}</p>
                                                                <p className="text-xs text-muted-foreground">Statut: {ticket.status}</p>
                                                            </div>
                                                        </div>
                                                        <Button variant="outline" size="sm">Voir le Billet</Button>
                                                    </div>
                                                </DialogTrigger>
                                                <DialogContent>
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
                            <h3 className="text-xl font-semibold">Aucun billet trouvé</h3>
                            <p className="text-muted-foreground mt-2">Vous n'avez encore acheté aucun billet pour des événements.</p>
                            <Button asChild className="mt-4">
                                <Link href="/events">Découvrir des événements</Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}
