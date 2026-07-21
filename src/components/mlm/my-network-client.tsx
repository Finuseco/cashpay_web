'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { User, Users, ChevronUp, Link as LinkIcon, Network } from 'lucide-react';
import { formatKiloMega } from '@/lib/utils';
import { BinaryTreeView } from './binary-tree-view';
import Link from 'next/link';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export function MyNetworkClient({ data }: { data: any }) {
    const { user, sponsor, nextRank, binaryStats, directReferrals } = data;

    const ppvProgress = nextRank ? (user.ppv / nextRank.min_ppv) * 100 : 0;
    const gvProgress = nextRank ? (user.gv / nextRank.min_gv) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                 <div>
                    <h1 className="text-3xl font-bold text-foreground">Mon Réseau</h1>
                    <p className="text-muted-foreground">Suivez votre progression, consultez votre équipe et vos gains.</p>
                </div>
                <div className="flex items-center gap-2 p-3 bg-card rounded-lg border">
                    <Avatar><AvatarImage /><AvatarFallback><User /></AvatarFallback></Avatar>
                    <div>
                        <p className="text-xs text-muted-foreground">Votre Parrain</p>
                        <p className="font-semibold">{sponsor.name}</p>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Mon Rang Actuel" value={user.rank} icon={ChevronUp} />
                <StatCard title="PV Personnels" value={user.ppv.toLocaleString()} icon={User} description="Ce mois-ci" />
                <StatCard title="PV Groupe" value={formatKiloMega(user.gv)} icon={Users} description="Ce mois-ci" />
                <StatCard title="Filleuls Directs" value={directReferrals.length.toString()} icon={LinkIcon} />
            </div>
            
            {nextRank && (
                <Card>
                    <CardHeader>
                        <CardTitle>Prochain Rang : {nextRank.name}</CardTitle>
                        <CardDescription>Votre progression vers le prochain niveau.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1"><span>PV Personnels</span><span>{user.ppv.toLocaleString()} / {nextRank.min_ppv.toLocaleString()}</span></div>
                            <Progress value={ppvProgress} />
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1"><span>PV de Groupe</span><span>{formatKiloMega(user.gv)} / {formatKiloMega(nextRank.min_gv)}</span></div>
                            <Progress value={gvProgress} />
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Statistiques Binaires</CardTitle></CardHeader>
                    <CardContent className="flex justify-around text-center">
                        <div>
                            <p className="text-sm text-muted-foreground">Branche Gauche</p>
                            <p className="text-2xl font-bold">{formatKiloMega(binaryStats.left)} PV</p>
                        </div>
                         <div>
                            <p className="text-sm text-muted-foreground">Branche Droite</p>
                            <p className="text-2xl font-bold">{formatKiloMega(binaryStats.right)} PV</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Généalogie</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-4">Aperçu de votre position dans l'arbre binaire.</p>
                        <Button asChild className="w-full">
                            <Link href="/mlm/network-marketing/tree"><Network className="mr-2 h-4 w-4"/> Voir l'arbre complet</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
