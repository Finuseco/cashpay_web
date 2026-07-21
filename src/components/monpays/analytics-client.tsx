
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { Eye, ThumbsUp, Share2, Users, DollarSign, Rocket, ArrowUpRight, History, RefreshCcw, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { formatKiloMega } from '@/lib/utils';
import { promoteToAdsNetwork } from '@/lib/actions/monpays.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import type { User } from '@/lib/types';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string, icon: React.ElementType, description?: string }) => (
    <Card className="bg-zinc-800 border-zinc-700 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-zinc-400" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-[10px] text-zinc-400 mt-1">{description}</p>}
        </CardContent>
    </Card>
);

export function MonPaysAnalyticsClient({ data, user }: { data: any, user: User }) {
    const { company, stats, budget, history } = data;
    const { openAlert } = useAlertDialog();
    const [isPromoting, setIsPromoting] = useState(false);
    const [isPinOpen, setIsPinOpen] = useState(false);
    const [pin, setPin] = useState('');

    const handlePromoteToAds = async () => {
        setIsPinOpen(true);
    };

    const confirmPromotion = async () => {
        setIsPromoting(true);
        const result = await promoteToAdsNetwork({
            user,
            postId: 'latest', // Example: promote latest post
            budget: 10,
            pin
        });
        setIsPromoting(false);
        setIsPinOpen(false);

        if (result.success) {
            openAlert({ title: 'Promotion Activée', description: 'Votre publication est maintenant diffusée sur le réseau global Ads.', variant: 'success' });
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6">
            <Dialog open={isPinOpen} onOpenChange={setIsPinOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Confirmer la Promotion Global Ads</DialogTitle>
                        <DialogDescription>Un budget de 10 USD sera débité pour diffuser votre page sur tout le réseau blogueurs.</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center py-4">
                        <InputOTP maxLength={4} value={pin} onChange={setPin}>
                            <InputOTPGroup>
                                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                    <DialogFooter>
                        <Button onClick={confirmPromotion} disabled={isPromoting || pin.length < 4}>
                            {isPromoting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirmer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-zinc-700">
                    <AvatarImage src={company.logoUrl} />
                    <AvatarFallback>{company.company_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-2xl font-bold">{company.company_name}</h1>
                    <p className="text-zinc-400">Analytiques de la page</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Visites Page" value={formatKiloMega(stats.pageVisits)} icon={Users} description="30 derniers jours" />
                <StatCard title="Vues Posts" value={formatKiloMega(stats.postViews)} icon={Eye} />
                <StatCard title="Likes" value={formatKiloMega(stats.postLikes)} icon={ThumbsUp} />
                <StatCard title="Partages" value={formatKiloMega(stats.postShares)} icon={Share2} />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 bg-zinc-800 border-zinc-700 text-white">
                    <CardHeader><CardTitle>Evolution des Visites</CardTitle></CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="date" stroke="#666" fontSize={10} />
                                <YAxis stroke="#666" fontSize={10} />
                                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none' }} />
                                <Line type="monotone" dataKey="count" stroke="#FF6600" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-800 border-zinc-700 text-white">
                    <CardHeader>
                        <CardTitle>Budget Publicitaire</CardTitle>
                        <CardDescription className="text-zinc-400">Gains de boostage</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Restant</span>
                                <span className="font-bold">{budget.remaining.toLocaleString()} CDF</span>
                            </div>
                            <Progress value={(budget.remaining / (budget.remaining + budget.spent)) * 100} className="h-2 bg-zinc-700" />
                        </div>
                        <div className="pt-4 border-t border-zinc-700">
                            <div className="flex justify-between text-sm">
                                <span>Dépensé aux gagnants</span>
                                <span className="text-red-400 font-bold">-{budget.spent.toLocaleString()} CDF</span>
                            </div>
                        </div>
                        <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => {}}>
                            <RefreshCcw className="mr-2 h-4 w-4"/> Renouveler le Budget
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-primary/10 border-primary/20 text-white">
                <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary/20 rounded-full flex items-center justify-center">
                            <Rocket className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold">Passer au réseau Global Ads</h3>
                            <p className="text-sm text-zinc-400">Diffusez vos publications sur tous les blogs et apps partenaires.</p>
                        </div>
                    </div>
                    <Button onClick={handlePromoteToAds} className="bg-primary hover:bg-primary/90 text-white font-bold">
                        <ArrowUpRight className="mr-2 h-4 w-4"/> Activer maintenant
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
