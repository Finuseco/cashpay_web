'use client';

import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Network, ShoppingCart, DollarSign, Users, Loader2, Building2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import type { User, Product } from '@/lib/types';
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getMlmPartnerDetails } from "@/lib/actions/mlm.actions";
import { NetworkMarketingPartnerDashboard } from "@/components/mlm/network-marketing-dashboard";
import { getAgentProducts } from "@/lib/actions/agent.actions";
import { Badge } from "@/components/ui/badge";

const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    </div>
);

function OnboardingView() {
    return (
        <div className="space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-3">
                    <Network className="h-8 w-8 text-primary"/>
                    Marketing de Réseau
                </h1>
                <p className="text-muted-foreground mt-2">Vendez des produits, construisez votre réseau et gagnez des commissions sur chaque vente.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Comment ça marche ?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <FeatureCard 
                        icon={ShoppingCart}
                        title="Vendez des Produits Exclusifs"
                        description="Accédez à un catalogue de produits de qualité à vendre. Chaque vente que vous réalisez vous rapporte une commission directe."
                    />
                     <FeatureCard 
                        icon={Users}
                        title="Construisez Votre Équipe"
                        description="Parrainez de nouveaux vendeurs pour rejoindre votre réseau. Vous gagnerez un pourcentage sur les ventes générées par toute votre équipe."
                    />
                     <FeatureCard 
                        icon={DollarSign}
                        title="Gagnez sur la Consommation"
                        description="Votre rémunération est basée sur un système binaire puissant, vous récompensant sur le volume des ventes de vos deux branches de réseau."
                    />
                </CardContent>
            </Card>

             <div className="text-center">
                <h2 className="text-xl font-semibold">Prêt à démarrer votre entreprise ?</h2>
                <p className="text-muted-foreground mt-1">Enregistrez votre entreprise pour vendre vos produits via notre réseau.</p>
                <Button asChild size="lg" className="mt-4">
                   <Link href="/mlm/network-marketing/register">
                    Enregistrer mon Entreprise
                   </Link>
                </Button>
            </div>
        </div>
    )
}

function LoadingView() {
    return (
        <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary"/>
            <p className="text-muted-foreground mt-4">Chargement de votre espace partenaire...</p>
        </div>
    )
}

function PendingView({ partner }: { partner: any }) {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Card className="border-yellow-200 bg-yellow-50/50">
                <CardContent className="pt-6 text-center space-y-4">
                    <div className="h-16 w-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-yellow-800">{partner.company_name}</h2>
                        <Badge variant="outline" className="mt-1 border-yellow-500 text-yellow-700">Demande en cours d'examen</Badge>
                    </div>
                    <p className="text-sm text-yellow-700 max-w-md mx-auto">
                        Merci d'avoir soumis votre demande pour devenir un partenaire de marketing de réseau. Notre équipe vérifie actuellement vos informations. Vous serez notifié dès que votre compte sera activé.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

export default function NetworkMarketingPage() {
    const [user, setUser] = useState<User | null>(null);
    const [partnerDetails, setPartnerDetails] = useState<any>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            if (fetchedUser) {
                const [details, agentProducts] = await Promise.all([
                    getMlmPartnerDetails(fetchedUser.id),
                    getAgentProducts(fetchedUser.id)
                ]);
                setPartnerDetails(details);
                setProducts(agentProducts);
            }
            setIsLoading(false);
        };
        fetchDetails();
    }, []);

    const renderContent = () => {
        if (isLoading) {
            return <LoadingView />;
        }
        if (partnerDetails) {
            if (partnerDetails.status === 'active' || partnerDetails.status === 'approved') {
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 bg-primary/10 rounded-lg flex items-center justify-center">
                                    <Building2 className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-foreground">{partnerDetails.company_name}</h1>
                                    <p className="text-sm text-muted-foreground">{partnerDetails.product_category}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <Badge className="bg-green-500 hover:bg-green-600 gap-1 px-3 py-1">
                                    <CheckCircle2 className="h-3 w-3" /> Partenaire Actif
                                </Badge>
                                <p className="text-[10px] text-muted-foreground mt-1">Depuis le {new Date(partnerDetails.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <NetworkMarketingPartnerDashboard partner={partnerDetails} products={products} />
                    </div>
                );
            }
            if (partnerDetails.status === 'pending') {
                return <PendingView partner={partnerDetails} />;
            }
        }
        return <OnboardingView />;
    };

    return (
        <DashboardLayout pageTitleKey="pageTitleNetworkMarketing">
            <main className="flex-1 p-4 md:p-8">
                 <div className="max-w-6xl mx-auto space-y-8">
                     <Button asChild variant="ghost" className="mb-4">
                        <Link href="/mlm"><ArrowLeft className="mr-2 h-4 w-4" /> Retour aux Partenariats</Link>
                     </Button>
                     <Suspense fallback={<LoadingView />}>
                        {renderContent()}
                    </Suspense>
                </div>
            </main>
        </DashboardLayout>
    );
}