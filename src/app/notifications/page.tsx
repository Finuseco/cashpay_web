
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import type { Notification, User } from '@/lib/types';
import { getNotifications, markAllNotificationsAsRead } from '@/lib/actions/notification.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

function NotificationLoading() {
    return (
        <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 p-4 border-b">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-1/4 self-end" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function NotificationsPage() {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            if (fetchedUser) {
                setUser(fetchedUser);
                const fetchedNotifications = await getNotifications(fetchedUser.id, 100);
                setNotifications(fetchedNotifications);
                setFilteredNotifications(fetchedNotifications);
            }
            setIsLoading(false);
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        const results = notifications.filter(n => 
            n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredNotifications(results);
    }, [searchTerm, notifications]);

    const handleMarkAllRead = async () => {
        if (!user) return;
        setNotifications(notifications.map(n => ({ ...n, read: true })));
        setFilteredNotifications(filteredNotifications.map(n => ({ ...n, read: true })));
        await markAllNotificationsAsRead(user.id);
    };
    
    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                     <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
                            <p className="text-muted-foreground">Historique de vos alertes et communications.</p>
                        </div>
                        <Button variant="outline" onClick={handleMarkAllRead}>Marquer tout comme lu</Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Rechercher par mot-clé..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                             {isLoading ? (
                                <NotificationLoading />
                             ) : filteredNotifications.length > 0 ? (
                                <div className="space-y-1">
                                    {filteredNotifications.map(notification => (
                                        <div key={notification.id} className={cn("p-4 border-b last:border-b-0", !notification.read && "bg-accent/50")}>
                                            <p className="font-semibold">{notification.title}</p>
                                            <p className="text-sm text-muted-foreground">{notification.description}</p>
                                            <p className="text-xs text-muted-foreground mt-2 text-right">
                                                {format(new Date(notification.timestamp), 'dd MMMM yyyy, HH:mm', { locale: fr })}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <div className="text-center text-muted-foreground py-16">
                                    <p>Aucune notification trouvée.</p>
                                </div>
                             )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </DashboardLayout>
    )
}
