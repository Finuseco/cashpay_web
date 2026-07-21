
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { FlightBookingClient } from "@/components/flights/flight-booking-client";
import { MyBookingsList } from "@/components/flights/my-bookings-list";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getCountriesList } from "@/lib/actions/countries.actions";
import { getMyBookings } from "@/lib/actions/flight.actions";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plane, History } from "lucide-react";

export default async function FlightsPage() {
    const user = await getAuthenticatedUser();
    const countries = await getCountriesList();

    if (!user) {
        redirect('/login');
    }
    
    const bookings = await getMyBookings(user.id);

    return (
        <DashboardLayout pageTitleKey="pageTitleFlights">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-8">
                    <Tabs defaultValue="book" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto h-12 bg-muted/50 p-1">
                            <TabsTrigger value="book" className="data-[state=active]:bg-background">
                                <Plane className="mr-2 h-4 w-4" /> Nouvelle Réservation
                            </TabsTrigger>
                            <TabsTrigger value="history" className="data-[state=active]:bg-background">
                                <History className="mr-2 h-4 w-4" /> Mes Voyages
                            </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="book" className="pt-6">
                            <FlightBookingClient user={user} countries={countries} />
                        </TabsContent>
                        
                        <TabsContent value="history" className="pt-6">
                             <div className="max-w-3xl mx-auto">
                                <MyBookingsList bookings={bookings} />
                             </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </DashboardLayout>
    );
}
