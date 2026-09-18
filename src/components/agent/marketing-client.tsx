'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ShoppingBag, History, Check, Loader2, ShieldCheck, Users, Edit, Send, Globe, LayoutGrid, Rows, Star, Target, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User, SmsPackage, SmsPurchase, SentSmsCampaign, Country, Product, MarketingCampaign } from '@/lib/types';
import { purchaseSmsPackage, sendMarketingSms, sendProductBoostEmail, getMarketingCampaigns } from '@/lib/actions/marketing.actions';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ratesFromUSD } from '@/config/rates';
import { Skeleton } from '../ui/skeleton';
import { getAgentProducts } from '@/lib/actions/agent.actions';
import { ProductBoostEmailPreview } from './product-boost-email-preview';
import Image from 'next/image';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Label } from '../ui/label';
import { Badge } from '@/components/ui/badge';

type LayoutStyle = '2-cols' | '3-cols' | 'featured';

const pinSchema = z.object({
  pin: z.string().length(4, 'Le PIN doit contenir 4 chiffres.'),
});

const boostPackages = [
    { id: 'pack_6', name: '6 Produits', productCount: 6, price: 1.00 },
    { id: 'pack_10', name: '10 Produits', productCount: 10, price: 1.50 },
    { id: 'pack_15', name: '15 Produits', productCount: 15, price: 2.00 },
];

const layoutOptions: { id: LayoutStyle, name: string, icon: React.ElementType }[] = [
    { id: '2-cols', name: 'Grille (2 colonnes)', icon: LayoutGrid },
    { id: '3-cols', name: 'Grille (3 colonnes)', icon: Rows },
    { id: 'featured', name: 'Produit en vedette', icon: Star },
];

const smsCampaignSchema = z.object({
    message: z.string().min(10, "Le message doit contenir au moins 10 caractères."),
});

const SmsCampaignForm = ({ agent, clients, countries, initialBalance, onCampaignSent }: { agent: User, clients: Pick<User, 'id_wallet' | 'full_name' | 'phone' | 'country'>[], countries: Country[], initialBalance: number, onCampaignSent: () => void }) => {
    const [balance, setBalance] = useState(initialBalance);
    const [selectedCountry, setSelectedCountry] = useState('all');
    const [isSending, setIsSending] = useState(false);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof smsCampaignSchema>>({
        resolver: zodResolver(smsCampaignSchema),
        defaultValues: { message: '' }
    });

    const filteredClients = useMemo(() => {
        if (selectedCountry === 'all') return clients;
        const countryName = countries.find(c => c.code === selectedCountry)?.name;
        return clients.filter(c => c.country === countryName);
    }, [clients, selectedCountry, countries]);
    
    const message = form.watch('message');
    const cost = filteredClients.length;

    const handleSendSms = async (values: z.infer<typeof smsCampaignSchema>) => {
        if (balance < cost) {
            openAlert({ title: 'Solde SMS insuffisant', description: 'Veuillez acheter plus de SMS avant d\'envoyer cette campagne.', variant: 'warning'});
            return;
        }
        setIsSending(true);
        const result = await sendMarketingSms({
            agentId: agent.id,
            message: values.message,
            recipients: filteredClients.map(c => ({ phone: c.phone!, name: c.full_name })),
        });

        if (result.success) {
            openAlert({ title: 'Campagne Envoyée', description: 'Votre campagne SMS a été envoyée avec succès.', variant: 'success'});
            setBalance(result.newBalance || balance - cost);
            onCampaignSent();
            form.reset();
        } else {
             openAlert({ title: 'Erreur', description: result.error || "Impossible d'envoyer la campagne.", variant: 'error'});
        }
        setIsSending(false);
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Solde SMS Actuel</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold">{balance.toLocaleString()} <span className="text-lg text-muted-foreground">SMS</span></p>
                </CardContent>
            </Card>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSendSms)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Créer une Campagne SMS</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="message"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Message</FormLabel>
                                        <FormControl><Textarea placeholder="Votre message ici..." {...field} /></FormControl>
                                        <FormDescription>Vous pouvez utiliser `[Nom]` pour personnaliser le message avec le nom du client.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div>
                               <FormLabel>Ciblage des Clients</FormLabel>
                               <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                                   <SelectTrigger className="mt-2">
                                       <SelectValue placeholder="Sélectionnez une cible..." />
                                   </SelectTrigger>
                                   <SelectContent>
                                       <SelectItem value="all">Tous les Clients ({clients.length})</SelectItem>
                                       {countries.map(c => {
                                            const count = clients.filter(client => client.country === c.name).length;
                                            if (count > 0) {
                                               return <SelectItem key={c.code} value={c.code}>{c.name} ({count})</SelectItem>
                                            }
                                            return null;
                                       })}
                                   </SelectContent>
                               </Select>
                            </div>
                            
                            <Alert variant={balance >= cost ? "default" : "destructive"}>
                                <Info className="h-4 w-4"/>
                                <AlertTitle>Résumé de la Campagne</AlertTitle>
                                <AlertDescription>
                                    Cette campagne sera envoyée à {filteredClients.length} destinataires et coûtera {cost} unités SMS.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full" disabled={isSending || filteredClients.length === 0}>
                                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Envoyer la Campagne SMS
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    );
};

const CampaignHistory = ({ agent }: { agent: User }) => {
    const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCampaigns = async () => {
            setIsLoading(true);
            const data = await getMarketingCampaigns(agent.id);
            setCampaigns(data);
            setIsLoading(false);
        };
        fetchCampaigns();
    }, [agent.id]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Historique des Campagnes E-mail</CardTitle>
                <CardDescription>Retrouvez ici toutes vos campagnes de boost par e-mail.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Package</TableHead>
                            <TableHead>Coût</TableHead>
                            <TableHead className="text-right">Statut</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                        ) : campaigns.length > 0 ? campaigns.map(c => (
                            <TableRow key={c.id}>
                                <TableCell>{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                <TableCell className="font-semibold">{c.package_name}</TableCell>
                                <TableCell>${c.package_cost.toFixed(2)}</TableCell>
                                <TableCell className="text-right"><Badge className="bg-green-500">Envoyée</Badge></TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune campagne envoyée.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


export function MarketingClient({ 
    initialClients, 
    initialSmsPackages, 
    agent,
    initialSmsBalance,
    initialPurchaseHistory,
    initialSentHistory,
    countries = []
}: { 
    initialClients: Pick<User, 'id_wallet' | 'full_name' | 'phone' | 'country'>[], 
    initialSmsPackages: SmsPackage[], 
    agent: User,
    initialSmsBalance: number,
    initialPurchaseHistory: SmsPurchase[],
    initialSentHistory: SentSmsCampaign[],
    countries?: Country[]
}) {
  const { openAlert } = useAlertDialog();
  const [agentProducts, setAgentProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // States for Boost Campaign
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [selectedPackage, setSelectedPackage] = useState(boostPackages[0]);
  const [selectedLayout, setSelectedLayout] = useState<LayoutStyle>('2-cols');
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isSubmittingBoost, setIsSubmittingBoost] = useState(false);


  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });

  useEffect(() => {
    const fetchProducts = async () => {
        setIsLoadingProducts(true);
        const products = await getAgentProducts(agent.id);
        setAgentProducts(products);
        setIsLoadingProducts(false);
    }
    fetchProducts();
  }, [agent.id]);

  const handleProductSelect = (product: Product, isSelected: boolean) => {
    setSelectedProducts(prev => {
        if (isSelected) {
            if (prev.length >= selectedPackage.productCount) {
                openAlert({
                    title: 'Limite atteinte',
                    description: `Vous ne pouvez sélectionner que ${selectedPackage.productCount} produits pour ce package.`,
                    variant: 'warning'
                });
                return prev;
            }
            return [...prev, product];
        } else {
            return prev.filter(p => p.id !== product.id);
        }
    });
  };

  const handleBoostSubmit = () => {
      if (selectedProducts.length === 0) {
          openAlert({ title: "Aucun produit sélectionné", description: "Veuillez sélectionner au moins un produit à promouvoir.", variant: 'warning' });
          return;
      }
      setIsPinDialogOpen(true);
  };
  
  const handlePinConfirm = async (values: z.infer<typeof pinSchema>) => {
      setIsSubmittingBoost(true);

      try {
          const result = await sendProductBoostEmail({
              agent: agent,
              products: selectedProducts,
              packageCost: selectedPackage.price,
              pin: values.pin,
              layoutStyle: selectedLayout,
          });

          if (result.success) {
              const recipientCount = result.recipientCount ?? 0;
              const sentCount = result.sentCount ?? 0;
              const failedCount = result.failedCount ?? 0;

              openAlert({
                  variant: failedCount > 0 ? 'warning' : 'success',
                  title: failedCount > 0 ? 'Campagne traitée avec avertissement' : 'Campagne Envoyée !',
                  description: `La campagne a été facturée et traitée pour ${recipientCount} adresse(s) e-mail. ${sentCount} e-mail(s) envoyé(s)${failedCount > 0 ? ` et ${failedCount} échec(s)` : ''}.`
              });
              setSelectedProducts([]);
              setIsPinDialogOpen(false);
          } else {
              openAlert({
                  variant: 'error',
                  title: 'Erreur',
                  description: result.error || 'Impossible de traiter la campagne e-mail.'
              });
          }
      } catch (error: any) {
          console.error('[Marketing Client] Product boost failed:', error);
          openAlert({
              variant: 'error',
              title: 'Erreur',
              description: error?.message || 'Une erreur interne est survenue. Veuillez réessayer ou contacter le support si le problème persiste.'
          });
      } finally {
          setIsSubmittingBoost(false);
          pinForm.reset();
      }
  }
  const boutiqueName = useMemo(() => {
      return agentProducts.length > 0 ? agentProducts[0].boutiqueName : 'Ma Boutique';
  }, [agentProducts]);


  return (
    <>
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'envoi de la campagne</DialogTitle>
            <DialogDescription>
              Veuillez entrer votre PIN pour confirmer le paiement de ${selectedPackage.price.toFixed(2)} et l'envoi de l'e-mail pour la boutique <strong>{boutiqueName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Form {...pinForm}>
              <form onSubmit={pinForm.handleSubmit(handlePinConfirm)} className="space-y-6 pt-4">
                  <FormField control={pinForm.control} name="pin" render={({ field }) => ( <FormItem><FormLabel>Code PIN Agent</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage /></FormItem> )}/>
                  <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                      <Button type="submit" variant="gradient" disabled={isSubmittingBoost}>
                          {isSubmittingBoost && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmer
                      </Button>
                  </DialogFooter>
              </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Tabs defaultValue="boost" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="boost">Boost par E-mail</TabsTrigger>
            <TabsTrigger value="sms">Marketing par SMS</TabsTrigger>
            <TabsTrigger value="ads">Publicité (Ads)</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="boost" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {/* Product Boost Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><Send /> Booster vos Produits par E-mail</CardTitle>
                            <CardDescription>Sélectionnez des produits, choisissez un package et une mise en page, puis envoyez une campagne e-mail au nom de votre boutique à tous les utilisateurs de CashPay.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Step 1: Select Products */}
                                <div>
                                    <h3 className="font-semibold mb-2">Étape 1 : Sélectionnez vos produits ({selectedProducts.length}/{selectedPackage.productCount})</h3>
                                    {isLoadingProducts ? (
                                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 h-48"><Skeleton className="w-full h-full col-span-full"/></div>
                                    ) : (
                                        <ScrollArea className="h-48 w-full rounded-md border p-2">
                                            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                                {agentProducts.map(p => (
                                                    <button key={p.id} onClick={() => handleProductSelect(p, !selectedProducts.find(sp => sp.id === p.id))} className="relative aspect-square border-2 rounded-md transition-all data-[state=checked]:border-primary data-[state=checked]:ring-2 data-[state=checked]:ring-primary" data-state={selectedProducts.find(sp => sp.id === p.id) ? 'checked' : 'unchecked'}>
                                                        <Image src={p.image} alt={p.name} fill className="object-cover rounded-sm" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity data-[state=checked]:opacity-100 flex items-center justify-center">
                                                            <Check className="h-8 w-8 text-white"/>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </div>
                                
                                {/* Step 2: Select Package & Layout */}
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="font-semibold mb-2">Étape 2 : Choisissez votre package</h3>
                                        <div className="grid grid-cols-3 gap-2">
                                            {boostPackages.map(pkg => (
                                                <button key={pkg.id} onClick={() => setSelectedPackage(pkg)} className="p-3 border rounded-lg text-center data-[state=active]:border-primary data-[state=active]:ring-2 data-[state=active]:ring-primary" data-state={selectedPackage.id === pkg.id ? 'active' : 'inactive'}>
                                                    <p className="font-bold">{pkg.productCount} <span className="font-normal">produits</span></p>
                                                    <p className="text-sm text-primary">${pkg.price.toFixed(2)}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-2">Étape 3 : Choisissez la mise en page</h3>
                                        <div className="grid grid-cols-3 gap-2">
                                                {layoutOptions.map(opt => {
                                                const Icon = opt.icon;
                                                return (
                                                    <button key={opt.id} onClick={() => setSelectedLayout(opt.id)} className="p-3 border rounded-lg text-center data-[state=active]:border-primary data-[state=active]:ring-2 data-[state=active]:ring-primary" data-state={selectedLayout === opt.id ? 'active' : 'inactive'}>
                                                        <Icon className="mx-auto h-6 w-6 mb-1"/>
                                                        <p className="text-xs">{opt.name}</p>
                                                    </button>
                                                )
                                                })}
                                        </div>
                                    </div>
                                </div>

                        </CardContent>
                    </Card>

                    {/* Email Preview */}
                    <div>
                        <h3 className="text-lg font-bold text-foreground mb-3">Étape 4 : Prévisualisation de l'e-mail</h3>
                        <div className="bg-zinc-800 rounded-lg overflow-hidden border">
                            <div className="p-2 bg-zinc-700 text-xs text-zinc-400">À : Tous les utilisateurs CashPay</div>
                            <div className="p-4">
                                <ProductBoostEmailPreview 
                                    agentName={boutiqueName || 'Ma Boutique'}
                                    agentCountry={agent.country}
                                    products={selectedProducts.slice(0, selectedPackage.productCount)} 
                                    layout={selectedLayout} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:sticky lg:top-24">
                        <Card>
                        <CardHeader>
                            <CardTitle>Résumé et Envoi</CardTitle>
                        </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span>Magasin:</span><span className="font-semibold truncate max-w-[150px]">{boutiqueName}</span></div>
                                    <div className="flex justify-between"><span>Package:</span><span className="font-semibold">{selectedPackage.name}</span></div>
                                    <div className="flex justify-between"><span>Mise en page:</span><span className="font-semibold">{layoutOptions.find(o => o.id === selectedLayout)?.name}</span></div>
                                    <div className="flex justify-between"><span>Produits sélectionnés:</span><span className="font-semibold">{selectedProducts.length} / {selectedPackage.productCount}</span></div>
                                    <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2"><span>Coût Total:</span><span>${selectedPackage.price.toFixed(2)}</span></div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" variant="gradient" onClick={handleBoostSubmit} disabled={selectedProducts.length === 0}>
                                    Payer et Envoyer la Campagne
                                </Button>
                            </CardFooter>
                        </Card>
                </div>
            </div>
        </TabsContent>
         <TabsContent value="sms" className="mt-4">
             <SmsCampaignForm agent={agent} clients={initialClients} countries={countries} initialBalance={initialSmsBalance} onCampaignSent={() => {}} />
         </TabsContent>
         <TabsContent value="ads" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3"><Target/> Publicité Ciblée (Ads)</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-16">
                     <p className="font-semibold">Bientôt disponible</p>
                    <p className="text-sm">Une plateforme pour créer des campagnes publicitaires qui s'affichent dans des applications et blogs partenaires.</p>
                </CardContent>
            </Card>
         </TabsContent>
         <TabsContent value="history" className="mt-4">
            <CampaignHistory agent={agent} />
        </TabsContent>
       </Tabs>
    </>
  );
}
