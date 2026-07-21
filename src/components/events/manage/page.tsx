
import { Suspense } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { getEventsForOrganizer } from '@/lib/actions/event.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, PlusCircle } from 'lucide-react';

async function ManageEventsContent() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login');
    }
    const events = await getEventsForOrganizer(user.id);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Gérer Mes Événements</h1>
                    <p className="text-muted-foreground">Consultez les statistiques et validez les billets pour vos événements.</p>
                </div>
                <Button asChild>
                    <Link href="/events/create">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Créer un nouvel événement
                    </Link>
                </Button>
            </div>

            {events.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {events.map(event => {
                         const totalSold = event.ticketTypes.reduce((sum, type) => sum + type.sold, 0);
                         const totalRevenue = event.ticketTypes.reduce((sum, type) => sum + (type.sold * type.price), 0);
                        return (
                            <Card key={event.id}>
                                <CardHeader>
                                    <CardTitle>{event.name}</CardTitle>
                                    <CardDescription>{new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <p><strong>Billets vendus :</strong> {totalSold}</p>
                                    <p><strong>Revenus générés :</strong> ${totalRevenue.toFixed(2)}</p>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild className="w-full">
                                        <Link href={`/events/manage/${event.id}`}>
                                            <Eye className="mr-2 h-4 w-4" /> Gérer & Scanner
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-20 border-2 border-dashed rounded-lg">
                    <h3 className="mt-4 text-lg font-semibold">Vous n'avez créé aucun événement</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Cliquez sur le bouton ci-dessus pour commencer.</p>
                </div>
            )}
        </div>
    );
}

export default function ManageEventsPage() {
    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <Suspense fallback={<div>Chargement de vos événements...</div>}>
                    <ManageEventsContent />
                </Suspense>
            </main>
        </DashboardLayout>
    );
}
