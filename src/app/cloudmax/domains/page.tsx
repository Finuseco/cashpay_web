
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreVertical, Globe, ExternalLink, Settings, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getDomainsForUser } from '@/lib/actions/domain.actions';
import type { User } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';

type DomainInfo = {
    name: string;
    expires: string;
    status: 'active' | 'expiring' | 'expired';
};

export default function MyDomainsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [domains, setDomains] = useState<DomainInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserAndDomains = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            if (fetchedUser) {
                const result = await getDomainsForUser(fetchedUser.id);
                if (result.success) {
                    setDomains(result.data || []);
                }
            }
            setIsLoading(false);
        };
        fetchUserAndDomains();
    }, []);

    const getStatusVariant = (status: DomainInfo['status']) => {
        switch (status) {
            case 'active': return 'default';
            case 'expiring': return 'destructive';
            case 'expired': return 'secondary';
            default: return 'outline';
        }
    };

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Mes Domaines</h1>
                            <p className="text-muted-foreground">Gérez tous vos noms de domaine enregistrés.</p>
                        </div>
                        <Button asChild>
                            <Link href="/cloudmax">
                                <PlusCircle className="mr-2 h-4 w-4" /> Enregistrer un nouveau domaine
                            </Link>
                        </Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Liste des Domaines</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center items-center h-48">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : domains.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nom de Domaine</TableHead>
                                            <TableHead>Statut</TableHead>
                                            <TableHead>Expire le</TableHead>
                                            <TableHead><span className="sr-only">Actions</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {domains.map(domain => (
                                            <TableRow key={domain.name}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 font-medium">
                                                        <Globe className="h-4 w-4 text-muted-foreground" />
                                                        {domain.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={getStatusVariant(domain.status)} className={domain.status === 'active' ? 'bg-green-500' : ''}>
                                                        {domain.status === 'active' ? 'Actif' : domain.status === 'expiring' ? 'Expire bientôt' : 'Expiré'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{new Date(domain.expires).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreVertical /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/cloudmax/domains/${domain.name}`}>
                                                                    <Settings className="mr-2 h-4 w-4"/> Gérer
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <ExternalLink className="mr-2 h-4 w-4"/> Visiter le site
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-16 text-muted-foreground">
                                    <p>Vous n'avez enregistré aucun nom de domaine.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </DashboardLayout>
    );
}
