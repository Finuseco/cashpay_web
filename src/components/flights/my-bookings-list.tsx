
'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plane, Users, Calendar, ArrowRight, Download, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MyBookingsList({ bookings }: { bookings: any[] }) {
    if (bookings.length === 0) {
        return (
            <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
                <Ticket className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                <p className="text-muted-foreground font-medium">Vous n'avez pas encore de réservations de vols.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {bookings.map((booking) => (
                <Card key={booking.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b py-3 px-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px]">{booking.booking_reference}</Badge>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                    {format(new Date(booking.created_at), 'dd MMM yyyy', { locale: fr })}
                                </span>
                            </div>
                            <Badge className={cn(
                                "text-[10px] uppercase font-bold",
                                booking.booking_status === 'confirmed' ? "bg-green-500" : "bg-zinc-500"
                            )}>
                                {booking.booking_status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-lg font-black text-foreground uppercase tracking-tight">{booking.origin_country}</p>
                                <p className="text-xs text-muted-foreground">Départ</p>
                            </div>
                            <div className="flex flex-col items-center px-4">
                                <Plane className="h-5 w-5 text-primary rotate-90 mb-1" />
                                <div className="h-px bg-zinc-200 w-16" />
                            </div>
                            <div className="flex-1 text-right">
                                <p className="text-lg font-black text-foreground uppercase tracking-tight">{booking.destination_country}</p>
                                <p className="text-xs text-muted-foreground">Arrivée</p>
                            </div>
                        </div>
                        
                        <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{format(new Date(booking.departure_date), 'dd/MM/yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm justify-end">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{booking.passenger_count} passager(s)</span>
                            </div>
                        </div>
                    </CardContent>
                    <div className="p-3 bg-zinc-50 border-t flex gap-2">
                        <Button variant="ghost" size="sm" className="flex-1 text-xs">Détails</Button>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                            <Download className="mr-2 h-3 w-3" /> E-Billet
                        </Button>
                    </div>
                </Card>
            ))}
        </div>
    );
}
