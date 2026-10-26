'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import {
    Server, Database, Globe, HardDrive, Cpu, MemoryStick,
    FolderOpen, Wrench, Plus, CheckCircle, Loader2, ArrowLeft,
    Zap, Shield, Infinity, Package
} from 'lucide-react';
import Link from 'next/link';
import {
    createHostingAccount, getHostingAccounts, HOSTING_PLANS
} from '@/lib/actions/domain.actions';
import type { HostingPlan } from '@/lib/actions/domain.actions';

// ─── Plan card ────────────────────────────────────────────────────────────────

type PlanKey = HostingPlan;
const PLAN_ICONS: Record<PlanKey, React.ReactNode> = {
    starter:   <Package className="h-8 w-8" />,
    pro:       <Zap className="h-8 w-8" />,
    unlimited: <Infinity className="h-8 w-8" />,
};
const PLAN_FEATURES: Record<PlanKey, string[]> = {
    starter: [
        '10 GB espace disque SSD',
        '2 bases de données MySQL',
        '5 adresses e-mail',
        'SSL gratuit (Let\'s Encrypt)',
        'Support Node.js / PHP',
        'Bande passante 100 GB/mois',
    ],
    pro: [
        '50 GB espace disque SSD',
        'Bases de données illimitées',
        '20 adresses e-mail',
        'SSL gratuit + Wildcard disponible',
        'Support Node.js / PHP / Python',
        'Bande passante 500 GB/mois',
        'Sous-domaines illimités',
        'Sauvegarde automatique quotidienne',
    ],
    unlimited: [
        'Espace disque illimité',
        'Bases de données illimitées',
        'E-mails illimités',
        'SSL Wildcard inclus',
        'Node.js / PHP / Python / Ruby',
        'Bande passante illimitée',
        'Sauvegarde horaire',
        'Adresse IP dédiée disponible',
        'Support prioritaire 24/7',
    ],
};

function PlanCard({
    planKey, selected, onSelect, loading
}: {
    planKey: PlanKey;
    selected: boolean;
    onSelect: () => void;
    loading: boolean;
}) {
    const plan = HOSTING_PLANS[planKey];
    const features = PLAN_FEATURES[planKey];
    const icon = PLAN_ICONS[planKey];
    const isPopular = planKey === 'pro';

    return (
        <Card className={`relative flex flex-col transition-all duration-200 ${
            selected ? 'ring-2 ring-primary shadow-lg shadow-primary/20' : 'hover:shadow-md'
        } ${isPopular ? 'ring-2 ring-primary' : ''}`}>
            {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-white px-3 py-0.5 text-xs font-semibold">
                        Populaire
                    </Badge>
                </div>
            )}
            <CardHeader className="pb-2">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${
                    isPopular ? 'bg-primary text-white' : 'bg-muted text-primary'
                }`}>
                    {icon}
                </div>
                <CardTitle className="text-xl">{plan.label}</CardTitle>
                <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-foreground">{plan.price_usd}$</span>
                    <span className="text-muted-foreground text-sm">/mois</span>
                </div>
                <CardDescription className="text-xs">
                    {plan.storage_gb ? `${plan.storage_gb} GB` : 'Illimité'} d'espace inclus
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
                {features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{f}</span>
                    </div>
                ))}
            </CardContent>
            <CardFooter>
                <Button
                    className="w-full"
                    variant={isPopular ? 'gradient' : selected ? 'default' : 'outline'}
                    onClick={onSelect}
                    disabled={loading}
                >
                    {loading && selected ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {selected ? 'Sélectionné' : 'Choisir'}
                </Button>
            </CardFooter>
        </Card>
    );
}

// ─── Compte hébergement actif ──────────────────────────────────────────────────

function HostingAccountCard({ account }: { account: any }) {
    const plan = HOSTING_PLANS[account.plan as PlanKey];
    const used = Math.floor(Math.random() * (plan?.storage_gb || 50)); // placeholder — real usage from VPS API
    const total = plan?.storage_gb;
    const pct = total ? Math.round((used / total) * 100) : 20;

    return (
        <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Server className="h-4 w-4 text-primary" />
                            {account.domain_name || `Hébergement #${account.id}`}
                        </CardTitle>
                        <CardDescription>Plan {plan?.label || account.plan}</CardDescription>
                    </div>
                    <Badge variant={account.status === 'active' ? 'default' : 'secondary'} className="shrink-0">
                        {account.status === 'active' ? 'Actif' : account.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Stockage */}
                <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Stockage utilisé</span>
                        <span>{total ? `${used} / ${total} GB` : `${used} GB utilisés`}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Actions rapides */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                        { icon: <FolderOpen className="h-4 w-4" />, label: 'Fichiers' },
                        { icon: <Database className="h-4 w-4" />, label: 'Bases de données' },
                        { icon: <Globe className="h-4 w-4" />, label: 'Sous-domaines' },
                        { icon: <Wrench className="h-4 w-4" />, label: 'Outils' },
                    ].map((item, i) => (
                        <button
                            key={i}
                            className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-all text-xs text-muted-foreground"
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Expire le {account.expires_at
                        ? new Date(account.expires_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
                        : '—'}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function HostingPage() {
    const { openAlert } = useAlertDialog();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
    const [purchasing, setPurchasing] = useState(false);

    useEffect(() => {
        getHostingAccounts().then(r => {
            if (r.success) setAccounts(r.data);
            setLoadingAccounts(false);
        });
    }, []);

    const handlePurchase = async () => {
        if (!selectedPlan) return;
        setPurchasing(true);
        const result = await createHostingAccount(selectedPlan);
        setPurchasing(false);
        if (result.success) {
            openAlert({
                title: 'Hébergement activé !',
                description: `Votre compte ${HOSTING_PLANS[selectedPlan].label} est en cours de déploiement. Vous recevrez une notification sous 5 minutes.`,
                variant: 'success',
            });
            setSelectedPlan(null);
            const r = await getHostingAccounts();
            if (r.success) setAccounts(r.data);
        } else {
            openAlert({
                title: 'Erreur',
                description: result.error || 'Impossible de créer le compte hébergement.',
                variant: 'error',
            });
        }
    };

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-10">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/cloudmax"><ArrowLeft /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                            <Server className="h-8 w-8 text-primary" />
                            Hébergement Web
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Déployez votre site sur nos serveurs VPS haute disponibilité.
                        </p>
                    </div>
                </div>

                {/* Infra badges */}
                <div className="flex flex-wrap gap-3">
                    {[
                        { icon: <Cpu className="h-4 w-4" />, label: 'Serveurs NVMe SSD' },
                        { icon: <MemoryStick className="h-4 w-4" />, label: 'RAM DDR5' },
                        { icon: <HardDrive className="h-4 w-4" />, label: 'Backup quotidien' },
                        { icon: <Shield className="h-4 w-4" />, label: 'DDoS Protection' },
                        { icon: <Globe className="h-4 w-4" />, label: 'CDN inclus' },
                    ].map((b, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground border">
                            {b.icon}
                            <span>{b.label}</span>
                        </div>
                    ))}
                </div>

                {/* Comptes actifs */}
                {loadingAccounts ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : accounts.length > 0 ? (
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-foreground">Mes hébergements</h2>
                        <div className="grid gap-4">
                            {accounts.map(a => <HostingAccountCard key={a.id} account={a} />)}
                        </div>
                        <Button variant="outline" className="gap-2" onClick={() => setSelectedPlan('starter')}>
                            <Plus className="h-4 w-4" /> Ajouter un hébergement
                        </Button>
                    </section>
                ) : null}

                {/* Plans */}
                <section className="space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {accounts.length > 0 ? 'Ajouter un plan' : 'Choisissez votre plan'}
                        </h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            Paiement via votre portefeuille ID Wallet · Sans engagement
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {(Object.keys(HOSTING_PLANS) as PlanKey[]).map(key => (
                            <PlanCard
                                key={key}
                                planKey={key}
                                selected={selectedPlan === key}
                                onSelect={() => setSelectedPlan(key)}
                                loading={purchasing}
                            />
                        ))}
                    </div>

                    {selectedPlan && (
                        <div className="flex justify-center">
                            <Button
                                size="lg"
                                variant="gradient"
                                onClick={handlePurchase}
                                disabled={purchasing}
                                className="min-w-[260px]"
                            >
                                {purchasing ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Activation en cours...</>
                                ) : (
                                    <>Activer le plan {HOSTING_PLANS[selectedPlan].label} — {HOSTING_PLANS[selectedPlan].price_usd}$/mois</>
                                )}
                            </Button>
                        </div>
                    )}
                </section>

                {/* Langages supportés */}
                <section>
                    <h2 className="text-xl font-bold text-foreground mb-4">Technologies supportées</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { name: 'Node.js', color: 'bg-green-100 text-green-800 border-green-200', desc: 'v18, v20, v22' },
                            { name: 'PHP', color: 'bg-purple-100 text-purple-800 border-purple-200', desc: '7.4, 8.1, 8.3' },
                            { name: 'Python', color: 'bg-blue-100 text-blue-800 border-blue-200', desc: '3.9, 3.11, 3.12' },
                            { name: 'Apache', color: 'bg-red-100 text-red-800 border-red-200', desc: 'HTTP/2, SSL' },
                        ].map((tech, i) => (
                            <div key={i} className={`rounded-xl border px-4 py-3 text-center ${tech.color}`}>
                                <p className="font-bold text-lg">{tech.name}</p>
                                <p className="text-xs opacity-70 mt-0.5">{tech.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
