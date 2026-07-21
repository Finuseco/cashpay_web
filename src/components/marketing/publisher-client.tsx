
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Loader2, PlusCircle, Copy, Code2, Eye, Globe, ShieldCheck, CheckCircle, ExternalLink, BarChart, FileText, Trash2 } from 'lucide-react';
import type { User, AdPlacement, PublisherSite, PublisherDetails } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getPublisherDetails, createAdPlacement, registerPublisherSite, verifySiteOwnership, deletePublisherSite } from '@/lib/actions/publisher.actions';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { PublisherAnalytics } from './publisher-analytics';


const placementFormSchema = z.object({
  name: z.string().min(3, "Le nom de l'emplacement est requis."),
  format: z.enum(['banner', 'popup', 'video'], { required_error: "Veuillez sélectionner un format." }),
});

const siteFormSchema = z.object({
    siteName: z.string().min(3, "Le nom du site est requis."),
    siteUrl: z.string().url("Veuillez entrer une URL valide.").startsWith('https://', "L'URL doit commencer par https://"),
});

const VerificationInstructions = ({ code, url }: { code: string, url: string }) => {
    const { toast } = useToast();
    const verificationTag = `<meta name="cashpay-verification" content="${code}">`;
    const handleCopy = () => {
        navigator.clipboard.writeText(verificationTag);
        toast({ title: "Copié !", description: "La balise de vérification a été copiée." });
    };

    return (
        <div className="space-y-4">
            <p>Votre site a été soumis. Pour le faire vérifier, suivez ces étapes :</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Copiez la balise meta ci-dessous.</li>
                <li>Collez-la dans la section `&lt;head&gt;` de la page d'accueil de votre site (`{url}`).</li>
                <li>Enregistrez les modifications sur votre site.</li>
                <li>Revenez sur cette page et cliquez sur "Vérifier" dans la liste de vos sites.</li>
            </ol>
            <div className="p-3 bg-zinc-800 rounded-md font-mono text-xs relative">
                <code>{verificationTag}</code>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

const PublisherDashboard = ({ details, onPlacementCreated, onSiteRegistered }: { details: PublisherDetails, onPlacementCreated: () => void, onSiteRegistered: () => void }) => {
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();
    const [selectedPlacement, setSelectedPlacement] = useState<AdPlacement | null>(null);
    const [isVerifying, setIsVerifying] = useState<number | null>(null);

    const handleCopy = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copié !", description: `${type} a été copié dans le presse-papiers.` });
    }

    const getEmbedCode = (placementCode: string) => {
        const adServerUrl = process.env.NEXT_PUBLIC_AD_SERVER_URL || 'http://localhost:8089';
        return `<iframe src="${adServerUrl}/?placement=${placementCode}" width="728" height="90" style="border:none; overflow:hidden;" scrolling="no"></iframe>`;
    }

    const handleVerify = async (site: PublisherSite) => {
        setIsVerifying(site.id);
        const result = await verifySiteOwnership(site.id);
        if (result.success) {
            openAlert({ title: "Vérification Réussie", description: "Votre site a été approuvé. Vous pouvez maintenant créer des emplacements publicitaires.", variant: 'success' });
            onSiteRegistered(); // Refresh data
        } else {
             const errorMessage = result.competitors 
                ? `${result.error} Concurrents détectés: ${result.competitors.join(', ')}.`
                : result.error || "Le code n'a pas été trouvé. Assurez-vous de l'avoir bien placé dans la section <head> de votre site.";
            openAlert({ title: "Échec de la Vérification", description: errorMessage, variant: 'error' });
        }
        setIsVerifying(null);
    };

    const handleDelete = async (site: PublisherSite) => {
        openAlert({
            title: 'Confirmer la suppression',
            description: `Êtes-vous sûr de vouloir supprimer le site "${site.name}" ? Tous les emplacements publicitaires associés seront également supprimés.`,
            variant: 'warning',
            onClose: async (confirmed) => {
                if (confirmed) {
                    const result = await deletePublisherSite(site.id);
                    if (result.success) {
                        toast({ title: 'Site supprimé', description: 'Le site a été supprimé avec succès.' });
                        onSiteRegistered();
                    } else {
                        openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
                    }
                }
            }
        });
    }

    const getStatusBadge = (status: PublisherSite['status']) => {
        switch (status) {
            case 'approved': return <Badge className="bg-green-500 hover:bg-green-600"><ShieldCheck className="mr-1 h-3 w-3"/> Approuvé</Badge>
            case 'rejected': return <Badge variant="destructive">Rejeté</Badge>
            default: return <Badge variant="secondary">En attente</Badge>
        }
    }

    return (
        <div className="space-y-6">
             <Dialog open={!!selectedPlacement} onOpenChange={(isOpen) => !isOpen && setSelectedPlacement(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Code d'Intégration</DialogTitle>
                        <DialogDescription>
                            Copiez et collez ce code sur votre site web à l'endroit où vous souhaitez que la publicité apparaisse.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedPlacement && (
                        <div className="space-y-4">
                            <Textarea 
                                readOnly 
                                value={getEmbedCode(selectedPlacement.placement_code)} 
                                className="font-mono text-xs h-32"
                            />
                            <Button onClick={() => handleCopy(getEmbedCode(selectedPlacement.placement_code), "Le code d'intégration")} className="w-full">
                                <Copy className="mr-2 h-4 w-4" /> Copier le code
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <PublisherAnalytics />
            
            <Card>
                <CardHeader>
                    <CardTitle>Vos Sites Enregistrés</CardTitle>
                    <CardDescription>Liste de vos sites et applications où vous pouvez afficher des publicités.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Site/App</TableHead><TableHead>URL</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                           {details.sites.length > 0 ? details.sites.map((site) => (
                                <TableRow key={site.id}>
                                    <TableCell className="font-medium">{site.name}</TableCell>
                                    <TableCell><a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">{site.url} <ExternalLink className="h-3 w-3"/></a></TableCell>
                                    <TableCell>{getStatusBadge(site.status)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {site.status === 'pending' && (
                                                <Button size="sm" variant="outline" onClick={() => handleVerify(site)} disabled={isVerifying === site.id}>
                                                    {isVerifying === site.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4" />}
                                                    <span className="ml-2">Vérifier</span>
                                                </Button>
                                            )}
                                             <Button size="sm" variant="destructive" onClick={() => handleDelete(site)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun site enregistré.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
                 <CardFooter>
                    <RegisterSiteDialog onSiteRegistered={onSiteRegistered} />
                </CardFooter>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Emplacements Publicitaires</CardTitle>
                        <CardDescription>Créez et gérez les zones où les publicités apparaîtront.</CardDescription>
                    </div>
                    <CreatePlacementDialog onPlacementCreated={onPlacementCreated} />
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow><TableHead>Nom</TableHead><TableHead>Format</TableHead><TableHead>Code d'Emplacement</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {details.placements.length > 0 ? details.placements.map((placement) => (
                                <TableRow key={placement.id}>
                                    <TableCell className="font-medium">{placement.name}</TableCell>
                                    <TableCell><Badge variant="outline">{placement.format}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs">{placement.placement_code}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(placement.placement_code, "Le code de placement")}>
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => setSelectedPlacement(placement)}>
                                            <Code2 className="mr-2 h-4 w-4" /> Obtenir le code
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun emplacement créé.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

const CreatePlacementDialog = ({ onPlacementCreated }: { onPlacementCreated: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof placementFormSchema>>({
        resolver: zodResolver(placementFormSchema),
        defaultValues: { format: 'banner' },
    });

    const onSubmit = async (values: z.infer<typeof placementFormSchema>) => {
        setIsSubmitting(true);
        const result = await createAdPlacement(values);
        setIsSubmitting(false);

        if (result.success) {
            onPlacementCreated();
            setIsOpen(false);
            form.reset();
            openAlert({ title: "Succès", description: "Le nouvel emplacement publicitaire a été créé.", variant: 'success' });
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/> Créer un Emplacement</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Créer un Nouvel Emplacement Publicitaire</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nom</FormLabel><FormControl><Input placeholder="Ex: Bannière Header (728x90)" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                        <FormField control={form.control} name="format" render={({ field }) => ( <FormItem><FormLabel>Format</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="banner">Bannière</SelectItem><SelectItem value="popup">Pop-up / Carré</SelectItem><SelectItem value="video">Vidéo</SelectItem></SelectContent></Select><FormMessage/></FormItem> )}/>
                         <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="animate-spin mr-2"/>} Créer
                            </Button>
                         </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

const RegisterSiteDialog = ({ onSiteRegistered }: { onSiteRegistered: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [verificationDetails, setVerificationDetails] = useState<{code: string; url: string} | null>(null);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof siteFormSchema>>({
        resolver: zodResolver(siteFormSchema),
        defaultValues: {
            siteName: "",
            siteUrl: "",
        }
    });

    const onSubmit = async (values: z.infer<typeof siteFormSchema>) => {
        setIsSubmitting(true);
        const result = await registerPublisherSite(values);
        setIsSubmitting(false);

        if (result.success && result.verificationCode) {
            setVerificationDetails({ code: result.verificationCode, url: values.siteUrl });
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    const closeAndRefresh = () => {
        setVerificationDetails(null);
        setIsOpen(false);
        form.reset();
        onSiteRegistered();
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setVerificationDetails(null); form.reset(); } setIsOpen(open); }}>
            <DialogTrigger asChild>
                <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/> Enregistrer un nouveau site</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{verificationDetails ? 'Vérifiez la propriété de votre site' : 'Enregistrer un nouveau site/app'}</DialogTitle>
                </DialogHeader>
                 {verificationDetails ? (
                    <>
                        <VerificationInstructions code={verificationDetails.code} url={verificationDetails.url} />
                        <DialogFooter>
                            <Button onClick={closeAndRefresh}>J'ai compris</Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                    <DialogDescription>
                        Ajoutez l'URL de votre site ou application où vous souhaitez afficher des publicités.
                    </DialogDescription>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField control={form.control} name="siteName" render={({ field }) => ( <FormItem><FormLabel>Nom du Site/App</FormLabel><FormControl><Input placeholder="Ex: Mon Blog Tech" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="siteUrl" render={({ field }) => ( <FormItem><FormLabel>URL</FormLabel><FormControl><Input placeholder="https://www.exemple.com" {...field} /></FormControl><FormMessage/></FormItem> )}/>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="animate-spin mr-2"/>} Soumettre pour vérification
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
};


export function PublisherClient() {
  const [user, setUser] = useState<User | null>(null);
  const [publisherDetails, setPublisherDetails] = useState<PublisherDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPublisherDetails = useCallback(async (userId: number) => {
    setIsLoading(true);
    const details = await getPublisherDetails(userId);
    setPublisherDetails(details);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const fetchedUser = await getAuthenticatedUser();
      setUser(fetchedUser);
      if (fetchedUser) {
        fetchPublisherDetails(fetchedUser.id);
      } else {
        setIsLoading(false);
      }
    };
    checkUser();
  }, [fetchPublisherDetails]);
  
  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!user) {
    return <p className="text-muted-foreground">Veuillez vous connecter pour accéder à votre portail éditeur.</p>;
  }
  
  if (!publisherDetails) {
    return (
        <Card className="text-center">
            <CardHeader>
                <CardTitle>Devenez un Éditeur Partenaire</CardTitle>
                <CardDescription>Monétisez votre site web ou votre application en affichant des publicités de notre réseau.</CardDescription>
            </CardHeader>
            <CardContent>
                <Globe className="h-16 w-16 mx-auto text-muted-foreground mb-4"/>
                <p className="text-muted-foreground mb-4">Pour commencer, enregistrez le site ou l'application que vous souhaitez monétiser.</p>
                <RegisterSiteDialog onSiteRegistered={() => fetchPublisherDetails(user.id)} />
            </CardContent>
        </Card>
    );
  }

  return <PublisherDashboard details={publisherDetails} onPlacementCreated={() => fetchPublisherDetails(user.id)} onSiteRegistered={() => fetchPublisherDetails(user.id)} />;
}

