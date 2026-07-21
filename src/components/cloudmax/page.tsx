
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Cloud, Server, Search, Loader2, XCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Input } from '@/components/ui/input';
import { checkDomainAvailability, addDomainToCart, purchaseDomain } from '@/lib/actions/domain.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { User } from '@/lib/types';
import { Label } from '../ui/label';

const DOMAIN_PRICE_PER_YEAR = 3;

function CloudWebSection({ user }: { user: User | null }) {
    const { openAlert } = useAlertDialog();
    const [domain, setDomain] = useState('');
    const [duration, setDuration] = useState('1');
    const [isSearching, setIsSearching] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [searchResult, setSearchResult] = useState<{ available: boolean; domain: string } | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!domain) return;
        setIsSearching(true);
        setSearchResult(null);
        const result = await checkDomainAvailability(domain);
        setSearchResult({ ...result, domain });
        setIsSearching(false);
    };

    const handleSubscription = async () => {
        if (!searchResult || !searchResult.available || !user) {
            openAlert({ title: 'Erreur', description: 'Veuillez d\'abord trouver un domaine disponible et vous connecter.', variant: 'error' });
            return;
        }

        setIsRegistering(true);
        const registrationYears = parseInt(duration, 10);
        const totalPrice = DOMAIN_PRICE_PER_YEAR * registrationYears;

        // Step 1: Add to eNom Cart
        const addToCartResult = await addDomainToCart(searchResult.domain, registrationYears, user);

        if (!addToCartResult.success) {
            openAlert({ title: 'Échec de l\'ajout au panier', description: addToCartResult.error || 'Une erreur est survenue.', variant: 'error' });
            setIsRegistering(false);
            return;
        }

        // Step 2: Finalize purchase (debits user and calls eNom Purchase)
        const purchaseResult = await purchaseDomain(user, searchResult.domain, registrationYears, totalPrice);

        if (purchaseResult.success) {
            openAlert({
                title: 'Enregistrement Réussi !',
                description: `Le domaine ${searchResult.domain} a été enregistré pour ${duration} an(s).`,
                variant: 'success'
            });
            setDomain('');
            setSearchResult(null);
        } else {
             openAlert({
                title: 'Échec de l\'enregistrement',
                description: purchaseResult.error || 'Une erreur est survenue lors de la finalisation.',
                variant: 'error'
            });
        }
        setIsRegistering(false);
    };

    return (
        <section>
            <div className="flex items-center gap-3 mb-4">
                <Server className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">Cloud Web</h2>
            </div>
            <Card className="shadow-lg hover:shadow-primary/20 transition-shadow">
                <CardHeader>
                    <CardTitle>Hébergement Web Tout-Inclus</CardTitle>
                    <CardDescription>La solution parfaite pour lancer votre site web. Trouvez et enregistrez votre nom de domaine idéal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                        <Input 
                            placeholder="exemple.com" 
                            value={domain}
                            onChange={(e) => {
                                setDomain(e.target.value);
                                setSearchResult(null);
                            }}
                            className="flex-grow"
                        />
                        <Button type="submit" disabled={isSearching || !domain}>
                            {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                            <span className="ml-2">Vérifier</span>
                        </Button>
                    </form>

                    {searchResult && (
                        <div className={`flex items-center gap-2 p-2 rounded-md text-sm ${searchResult.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {searchResult.available ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            <span>Le domaine <strong>{searchResult.domain}</strong> est {searchResult.available ? 'disponible !' : 'indisponible.'}</span>
                        </div>
                    )}
                    
                    {searchResult?.available && (
                         <div className="pt-2">
                            <Label>Durée d'enregistrement</Label>
                            <Select value={duration} onValueChange={setDuration}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[...Array(10).keys()].map(i => {
                                        const years = i + 1;
                                        return <SelectItem key={years} value={String(years)}>{years} an{years > 1 ? 's' : ''} - {DOMAIN_PRICE_PER_YEAR * years}$</SelectItem>
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <ul className="space-y-2 text-muted-foreground pt-2">
                        <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> <span>Hébergement web illimité</span></li>
                        <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> <span>Nom de domaine offert (si disponible)</span></li>
                        <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> <span>Panneau de contrôle cPanel</span></li>
                        <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> <span>Support technique 24/7</span></li>
                    </ul>
                </CardContent>
                <CardFooter className="flex flex-col items-stretch gap-2">
                    <Button className="w-full mt-2" variant="gradient" onClick={handleSubscription} disabled={!searchResult?.available || isRegistering}>
                         {isRegistering && <Loader2 className="animate-spin mr-2" />}
                        Enregistrer
                    </Button>
                </CardFooter>
            </Card>
        </section>
    )
}


export default function CloudMaxPage() {
    const { openAlert } = useAlertDialog();
    const [user, setUser] = useState<User | null>(null);

    React.useEffect(() => {
        const fetchUser = async () => {
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
        };
        fetchUser();
    }, []);

    const handleStorageSubscription = (planName: string, price: string) => {
        openAlert({
            title: 'Confirmation de Souscription',
            description: `Merci d'avoir souscrit à l'offre ${planName}. Le montant de ${price} sera débité de votre portefeuille.`,
            variant: 'success'
        });
    };

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-12">
                 <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="text-center sm:text-left">
                        <h1 className="text-4xl font-bold text-foreground tracking-tight">CloudMax</h1>
                        <p className="mt-2 text-lg text-muted-foreground">Solutions d'hébergement et de stockage fiables.</p>
                    </div>
                     <Button asChild>
                        <Link href="/cloudmax/domains">
                            Gérer mes domaines <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>

                <CloudWebSection user={user} />

                {/* Cloud Storage Section */}
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <Cloud className="h-8 w-8 text-primary" />
                        <h2 className="text-2xl font-bold text-foreground">Cloud Storage</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        <Card className="shadow-lg hover:shadow-primary/20 transition-shadow flex flex-col">
                            <CardHeader>
                                <CardTitle>Offre Annuelle 16GB</CardTitle>
                                <CardDescription>Idéal pour vos documents importants et photos.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 flex-1">
                                <p className="text-4xl font-extrabold text-foreground">4$ <span className="text-lg font-medium text-muted-foreground">/ an</span></p>
                                <ul className="space-y-2 text-muted-foreground">
                                    <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> <span>16 GB de stockage sécurisé</span></li>
                                    <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> <span>Accès depuis tous vos appareils</span></li>
                                </ul>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" variant="gradient" onClick={() => handleStorageSubscription('Stockage 16GB', '4 USD')}>Souscrire</Button>
                            </CardFooter>
                        </Card>
                        <Card className="shadow-lg hover:shadow-primary/20 transition-shadow ring-2 ring-primary flex flex-col">
                            <CardHeader>
                                <CardTitle>Stockage Illimité</CardTitle>
                                <CardDescription>Ne vous souciez plus jamais de l'espace disque.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 flex-1">
                                <p className="text-4xl font-extrabold text-foreground">5$ <span className="text-lg font-medium text-muted-foreground">/ mois</span></p>
                                 <ul className="space-y-2 text-muted-foreground">
                                    <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> <span>Espace de stockage illimité</span></li>
                                    <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> <span>Partage de fichiers facile</span></li>
                                    <li className="flex items-center gap-2"><Check className="h-5 w-5 text-green-500" /> <span>Renouvellement automatique</span></li>
                                </ul>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" variant="gradient" onClick={() => handleStorageSubscription('Stockage Illimité', '5 USD')}>Souscrire</Button>
                            </CardFooter>
                        </Card>
                    </div>
                </section>
            </div>
        </main>
    );
}
