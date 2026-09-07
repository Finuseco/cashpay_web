'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { 
    searchCountryUsers, toggleUserStatus, resetClientPin, 
    updateClientContact, getClientKycDetails, updateClientProfilePhoto, upgradeToBusinessAccount
} from '@/lib/actions/super-agent/users.actions';
import { 
    getUserTransactionsForSuperAgent, 
    getClientBalancesForAdmin, 
    superAgentDeposit
} from '@/lib/actions/super-agent/finance.actions';
import { 
    getUserCardsForAdmin
} from '@/lib/actions/super-agent/logistics.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Search, ShieldAlert, Loader2, Eye, 
    Edit, CreditCard, Printer, ChevronRight, Coins,
    Camera, KeyRound, Building, User as UserIcon,
    Phone, Mail
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import type { User, Card as CardInterface, Transaction } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TransactionReceipt } from '@/components/transactions/transaction-receipt';
import { Logo } from '@/components/logo';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const contactUpdateSchema = z.object({
    phone: z.string().min(9, "Téléphone requis."),
    email: z.string().email("Email invalide."),
    adminPin: z.string().length(4, "PIN requis."),
});

const depositSchema = z.object({
    amount: z.coerce.number().positive("Montant requis."),
    currency: z.string({ required_error: "Devise requise." }),
    adminPin: z.string().length(4, "PIN requis."),
});

const suspensionSchema = z.object({
    reason: z.string().min(10, "Veuillez fournir une raison détaillée (min 10 car.)."),
});

const adminPinSchema = z.object({
    pin: z.string().length(4, "PIN requis."),
});

const businessUpgradeSchema = z.object({
    companyName: z.string().min(3, "Le nom de l'entreprise est requis."),
    pin: z.string().length(4, "PIN requis."),
});

export default function SuperAgentUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [superAgent, setSuperAgent] = useState<User | null>(null);
    
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userHistory, setUserHistory] = useState<Transaction[]>([]);
    const [userCards, setUserCards] = useState<CardInterface[]>([]);
    const [userBalances, setUserBalances] = useState<Record<string, number> | null>(null);
    const [userKyc, setUserKyc] = useState<any>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isEditContactOpen, setIsEditContactOpen] = useState(false);
    const [isDepositOpen, setIsDepositOpen] = useState(false);
    const [isSuspensionDialogOpen, setIsSuspensionDialogOpen] = useState(false);
    const [isBusinessUpgradeOpen, setIsBusinessUpgradeOpen] = useState(false);
    
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { openAlert } = useAlertDialog();
    const { toast } = useToast();

    const contactForm = useForm<z.infer<typeof contactUpdateSchema>>({
        resolver: zodResolver(contactUpdateSchema),
    });

    const depositForm = useForm<z.infer<typeof depositSchema>>({
        resolver: zodResolver(depositSchema),
        defaultValues: { currency: 'USD' }
    });

    const suspensionForm = useForm<z.infer<typeof suspensionSchema>>({
        resolver: zodResolver(suspensionSchema),
        defaultValues: { reason: "" }
    });

    const balancePinForm = useForm<z.infer<typeof adminPinSchema>>({
        resolver: zodResolver(adminPinSchema),
        defaultValues: { pin: "" },
    });

    const businessUpgradeForm = useForm<z.infer<typeof businessUpgradeSchema>>({
        resolver: zodResolver(businessUpgradeSchema),
        defaultValues: { companyName: "", pin: "" },
    });

    const loadUsers = async (agentId: number, query = '') => {
        setIsLoading(true);
        try {
            const results = await searchCountryUsers(agentId, query.trim());
            setUsers(Array.isArray(results) ? results : []);
            return Array.isArray(results) ? results : [];
        } catch (e: any) {
            toast({
                title: 'Erreur de chargement',
                description: e?.message || 'Impossible de récupérer les utilisateurs.',
                variant: 'destructive'
            });
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            const agent = await getAuthenticatedUser();
            if (cancelled) return;
            setSuperAgent(agent);
            if (agent?.id) await loadUsers(agent.id, '');
            else setIsLoading(false);
        };
        init();
        return () => {
            cancelled = true;
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, []);

    const handleSearch = async () => {
        if (!superAgent?.id) return;
        await loadUsers(superAgent.id, searchTerm);
    };

    // Recherche progressive : le bouton reste disponible, mais la liste se met aussi à jour
    // lorsque l'utilisateur tape, sans multiplier les requêtes.
    useEffect(() => {
        if (!superAgent?.id) return;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            loadUsers(superAgent.id, searchTerm);
        }, searchTerm.trim() ? 350 : 0);
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, [searchTerm, superAgent?.id]);

    const handleViewDetails = async (user: User) => {
        setSelectedUser(user);
        setUserBalances(null);
        setIsLoadingDetails(true);
        try {
            const [history, cards, kyc] = await Promise.all([
                getUserTransactionsForSuperAgent(user.id),
                getUserCardsForAdmin(user.id),
                getClientKycDetails(user.id, superAgent!.id)
            ]);
            setUserHistory(history);
            setUserCards(cards as CardInterface[]);
            setUserKyc(kyc);
            
            if (user.role === 'PartnerB2B' || user.account_type === 'business') {
                businessUpgradeForm.setValue('companyName', user.full_name);
            }
        } catch (e) {
            toast({ title: "Erreur lors du chargement des détails", variant: "destructive" });
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleUpdateContact = async (values: z.infer<typeof contactUpdateSchema>) => {
        if (!selectedUser || !superAgent) return;
        setIsSubmitting(true);
        const result = await updateClientContact({
            targetUserId: selectedUser.id,
            adminId: superAgent.id,
            pin: values.adminPin,
            newPhone: values.phone,
            newEmail: values.email
        });
        setIsSubmitting(false);
        if (result.success) {
            toast({ title: "Coordonnées mises à jour", variant: "success" });
            setIsEditContactOpen(false);
            handleViewDetails(selectedUser);
            await loadUsers(superAgent.id, searchTerm);
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    const handleSovereignDeposit = async (values: z.infer<typeof depositSchema>) => {
        if (!selectedUser || !superAgent) return;
        setIsSubmitting(true);
        const result = await superAgentDeposit({
            adminId: superAgent.id,
            targetUserId: selectedUser.id,
            amount: values.amount,
            currency: values.currency,
            pin: values.adminPin
        });
        setIsSubmitting(false);
        if (result.success) {
            toast({ title: "Dépôt effectué", variant: "success" });
            setIsDepositOpen(false);
            depositForm.reset();
            await handleViewDetails(selectedUser);
            await loadUsers(superAgent.id, searchTerm);
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    const handleToggleStatusClick = () => {
        if (!selectedUser || !superAgent) return;
        if (selectedUser.status === 'Active') {
            setIsSuspensionDialogOpen(true);
        } else {
            openAlert({
                title: "Réactiver l'utilisateur ?",
                description: `Voulez-vous rétablir l'accès pour ${selectedUser.full_name} ?`,
                variant: 'info',
                showCancel: true,
                onClose: async (confirmed) => {
                    if (confirmed) {
                        const res = await toggleUserStatus(selectedUser.id, selectedUser.status, superAgent.id);
                        if (res.success) {
                            setSelectedUser({ ...selectedUser, status: res.status! });
                            toast({ title: "Utilisateur réactivé", variant: "success" });
                        }
                    }
                }
            });
        }
    }

    const handleConfirmSuspension = async (values: z.infer<typeof suspensionSchema>) => {
        if (!selectedUser || !superAgent) return;
        setIsSubmitting(true);
        const result = await toggleUserStatus(selectedUser.id, selectedUser.status, superAgent.id, values.reason);
        setIsSubmitting(false);
        if (result.success) {
            setSelectedUser({ ...selectedUser, status: result.status! });
            setIsSuspensionDialogOpen(false);
            suspensionForm.reset();
            toast({ title: "Utilisateur suspendu", variant: "destructive" });
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    }

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedUser || !superAgent) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result as string;
            openAlert({
                title: "Modifier la photo ?",
                description: "Veuillez entrer votre PIN Admin pour confirmer le changement de photo.",
                variant: 'info',
                showCancel: true,
                confirmText: "Suivant",
                onClose: (confirmed) => {
                    if (confirmed) {
                        const pin = prompt("Entrez votre PIN Admin :");
                        if (pin) {
                            updateClientProfilePhoto(selectedUser.id, superAgent.id, base64, pin).then(res => {
                                if (res.success) {
                                    toast({ title: "Photo mise à jour", variant: "success" });
                                    handleViewDetails(selectedUser);
                                } else {
                                    openAlert({ title: "Erreur", description: res.error, variant: 'error' });
                                }
                            });
                        }
                    }
                }
            });
        };
    };

    const handleBusinessUpgrade = async (values: z.infer<typeof businessUpgradeSchema>) => {
        if (!selectedUser || !superAgent) return;
        setIsSubmitting(true);
        const result = await upgradeToBusinessAccount(selectedUser.id, superAgent.id, values.companyName, values.pin);
        setIsSubmitting(false);
        if (result.success) {
            toast({ title: "Compte transformé en Entreprise", variant: "success" });
            setIsBusinessUpgradeOpen(false);
            businessUpgradeForm.reset();
            setSelectedUser({ ...selectedUser, full_name: values.companyName, role: 'PartnerB2B', account_type: 'business' });
            handleViewDetails(selectedUser);
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    const handleVerifyPinForBalances = async (values: z.infer<typeof adminPinSchema>) => {
        if (!selectedUser || !superAgent) return;
        setIsSubmitting(true);
        const result = await getClientBalancesForAdmin(selectedUser.id, superAgent.id, values.pin);
        setIsSubmitting(false);
        if (result.success) {
            setUserBalances(result.balances!);
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Base de Données Clients</h1>
                <p className="text-sm text-zinc-400">Juridiction : {superAgent?.country}</p>
            </div>

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardContent className="pt-6">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <Input 
                                placeholder="Rechercher par Nom, Wallet ID ou Téléphone..." 
                                className="pl-9 bg-zinc-900 border-zinc-700 h-12" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button className="h-12 px-8" onClick={handleSearch} disabled={isLoading}>
                            {isLoading ? <Loader2 className="animate-spin h-4 w-4"/> : "Rechercher"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between text-xs text-zinc-500"><span>{users.length} utilisateur(s) chargé(s)</span>{searchTerm && <span>Recherche : <strong className="text-zinc-300">{searchTerm}</strong></span>}</div>

            <div className="grid gap-4">
                {isLoading ? (
                    <div className="text-center py-20"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary"/></div>
                ) : users.length > 0 ? users.map(user => (
                    <Card key={user.id} className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700/50 transition-colors cursor-pointer" onClick={() => handleViewDetails(user)}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12 border-2 border-primary"><AvatarImage src={user.profile_photo || ''} /><AvatarFallback>{String(user.full_name || '?').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold">{user.full_name}</p>
                                        {user.role === 'PartnerB2B' && <Badge variant="outline" className="text-[10px] border-primary text-primary">BUSINESS</Badge>}
                                    </div>
                                    <p className="text-xs text-primary font-mono">{user.id_wallet}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Badge className={cn(user.status === 'Active' ? 'bg-green-500' : 'bg-red-500')}>{user.status}</Badge>
                                <ChevronRight className="h-5 w-5 text-zinc-500"/>
                            </div>
                        </CardContent>
                    </Card>
                )) : (
                    <div className="text-center py-20 text-zinc-500 italic">
                        Aucun utilisateur trouvé sur votre territoire.
                    </div>
                )}
            </div>

            {/* Dialog Dossier Client */}
            <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                <DialogContent className="max-w-4xl bg-zinc-900 border-zinc-800 text-white max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b border-zinc-800">
                        <div className="flex items-center gap-4">
                            <div className="relative group cursor-pointer" onClick={() => photoInputRef.current?.click()}>
                                <Avatar className="h-16 w-16 border-2 border-primary group-hover:opacity-50 transition-opacity">
                                    <AvatarImage src={userKyc?.profile_photo || selectedUser?.profile_photo} />
                                    <AvatarFallback>{selectedUser?.full_name[0] || '?'}</AvatarFallback>
                                </Avatar>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"><Camera className="h-6 w-6"/></div>
                                <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <DialogTitle className="text-2xl truncate">{selectedUser?.full_name}</DialogTitle>
                                    <Badge variant="outline" className="border-zinc-700">{selectedUser?.role}</Badge>
                                </div>
                                <DialogDescription className="font-mono text-primary">{selectedUser?.id_wallet}</DialogDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsDepositOpen(true)}><Coins className="h-4 w-4 mr-2"/> Dépôt Souverain</Button>
                                <Button variant={selectedUser?.status === 'Active' ? 'destructive' : 'default'} size="sm" onClick={handleToggleStatusClick}>
                                    {selectedUser?.status === 'Active' ? 'Suspendre' : 'Réactiver'}
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <Tabs defaultValue="kyc" className="flex-1 overflow-hidden flex flex-col">
                        <TabsList className="bg-zinc-950 border-b border-zinc-800 rounded-none h-12">
                            <TabsTrigger value="kyc" className="flex-1">Dossier KYC</TabsTrigger>
                            <TabsTrigger value="balances" className="flex-1">Finances</TabsTrigger>
                            <TabsTrigger value="history" className="flex-1">Mouvements</TabsTrigger>
                            <TabsTrigger value="logistics" className="flex-1">Cartes</TabsTrigger>
                        </TabsList>

                        <ScrollArea className="flex-1">
                            <TabsContent value="kyc" className="p-6 space-y-8">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Coordonnées</h4>
                                            <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700 space-y-3 relative">
                                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-zinc-500" onClick={() => { contactForm.setValue('phone', selectedUser!.phone!); contactForm.setValue('email', selectedUser!.email!); setIsEditContactOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-primary"/><p>{selectedUser?.phone}</p></div>
                                                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-primary"/><p className="truncate">{selectedUser?.email || 'Non renseigné'}</p></div>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Garant / Urgence</h4>
                                            <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700">
                                                {userKyc?.representative ? ( 
                                                    <div className="space-y-1">
                                                        <p className="font-bold">{userKyc.representative.name}</p>
                                                        <p className="text-sm text-zinc-400">{userKyc.representative.relation}</p>
                                                        <p className="text-sm text-primary font-mono">{userKyc.representative.contact}</p>
                                                    </div> 
                                                ) : <p className="text-zinc-500 italic text-sm">Aucun garant enregistré.</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Signature</h4>
                                            <div className="aspect-video bg-white rounded-lg flex items-center justify-center p-4 border-2 border-zinc-800">
                                                {userKyc?.signature_image ? (
                                                    <img src={userKyc.signature_image} alt="Signature" className="max-h-full object-contain" />
                                                ) : <p className="text-zinc-400 italic">Non disponible.</p>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Pièce d'Identité</h4>
                                            <div className="space-y-4">
                                                <div className="relative aspect-[1.6/1] bg-zinc-800 rounded-lg overflow-hidden border-2 border-zinc-700">
                                                    {userKyc?.document?.id_front_image ? (
                                                        <Image src={userKyc.document.id_front_image} alt="ID Front" fill className="object-cover" />
                                                    ) : <div className="flex items-center justify-center h-full text-zinc-600"><UserIcon className="h-12 w-12"/></div>}
                                                    <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-bold">RECTO</div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                                                    <div><p className="text-zinc-500">Type</p><p className="font-bold uppercase">{userKyc?.document?.id_type || 'N/A'}</p></div>
                                                    <div><p className="text-zinc-500">N° Document</p><p className="font-mono font-bold text-primary">{userKyc?.document?.id_number || 'N/A'}</p></div>
                                                    <div className="col-span-2 pt-2 border-t border-zinc-700 mt-2">
                                                        <p className="text-zinc-500">Expire le</p>
                                                        <p className={cn("font-bold", userKyc?.document?.id_expiry_date && new Date(userKyc.document.id_expiry_date) < new Date() ? 'text-red-500' : 'text-white')}>
                                                            {userKyc?.document?.id_expiry_date ? format(new Date(userKyc.document.id_expiry_date), 'dd MMMM yyyy', { locale: fr }) : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="balances" className="p-6 space-y-6">
                                {!userBalances ? (
                                    <div className="flex flex-col items-center justify-center py-10 space-y-4 border-2 border-dashed border-zinc-800 rounded-xl text-center">
                                        <ShieldAlert className="h-10 w-10 text-amber-500" />
                                        <div><p className="font-bold">Informations Confidentielles</p><p className="text-xs text-zinc-500">PIN Admin requis pour consulter les soldes.</p></div>
                                        <Form {...balancePinForm}><form onSubmit={balancePinForm.handleSubmit(handleVerifyPinForBalances)} className="space-y-4">
                                            <FormField control={balancePinForm.control} name="pin" render={({field}) => ( <FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl> )} />
                                            <Button type="submit" className="w-full">Révéler les soldes</Button>
                                        </form></Form>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {Object.entries(userBalances).map(([cur, amt]) => ( 
                                                <Card key={cur} className="bg-zinc-950 border-zinc-800 shadow-lg">
                                                    <CardContent className="p-4 text-center">
                                                        <p className="text-xs text-zinc-500 font-bold uppercase mb-1">{cur}</p>
                                                        <p className="text-2xl font-black text-primary">{Number(amt).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</p>
                                                    </CardContent>
                                                </Card> 
                                            ))}
                                        </div>
                                        
                                        <Separator className="bg-zinc-800" />
                                        
                                        <div className="p-6 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center"><Building className="h-6 w-6 text-primary"/></div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold">Services Business & APIs</h4>
                                                    <p className="text-xs text-zinc-400">Activez les fonctions marchandes pour ce client.</p>
                                                </div>
                                                {selectedUser?.role !== 'PartnerB2B' ? (
                                                    <Button onClick={() => setIsBusinessUpgradeOpen(true)}><KeyRound className="mr-2 h-4 w-4"/> Activer le mode Entreprise</Button>
                                                ) : (
                                                    <Badge className="bg-green-500 font-bold">API ACTIVES</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="history" className="p-0">
                                <Table>
                                    <TableBody>
                                        {userHistory.map((tx, idx) => (
                                            <TableRow key={tx.id ?? idx} className="border-zinc-800 hover:bg-zinc-800/50">
                                                <TableCell className="text-[10px] text-zinc-500">{tx.date} {tx.time}</TableCell>
                                                <TableCell className="text-xs font-semibold">{tx.description}</TableCell>
                                                <TableCell className={cn("text-right font-bold text-xs", tx.type === 'sent' ? 'text-red-400' : 'text-green-400')}>
                                                    {tx.type === 'sent' ? '-' : '+'} {Number(tx.amount || 0).toFixed(2)} {tx.currency}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedTransaction(tx)}><Printer className="h-4 w-4"/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {userHistory.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-zinc-500">Aucun mouvement récent.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </TabsContent>

                            <TabsContent value="logistics" className="p-6">
                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Cartes Bancaires Liées</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {userCards.map(c => (
                                        <div key={c.id} className="p-3 border border-zinc-800 rounded-lg bg-zinc-950 flex items-center justify-between">
                                            <div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-primary"/><p className="text-sm font-bold uppercase">{c.brand} •••• {c.last4}</p></div>
                                            <Badge className={c.status === 'active' ? 'bg-green-500' : 'bg-red-500'}>{c.status}</Badge>
                                        </div>
                                    ))}
                                    {userCards.length === 0 && <p className="text-sm text-zinc-500 italic">Aucune carte active trouvée.</p>}
                                </div>
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>

                    <DialogFooter className="p-4 bg-zinc-950 border-t border-zinc-800"><Button variant="ghost" onClick={() => setSelectedUser(null)}>Fermer le dossier</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Receipt Modal */}
            <Dialog open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
                <DialogContent className="max-w-sm p-0 border-none bg-transparent shadow-none">
                    {selectedTransaction && (
                        <Card className="bg-white text-black p-4 font-mono text-xs">
                            <div className="text-center mb-4">
                                <Logo className="w-24 mx-auto" />
                                <p className="font-bold mt-2 uppercase">Agence Nationale {superAgent?.country}</p>
                                <p className="text-[8px]">Certifié par Super Agent {superAgent?.id_wallet}</p>
                            </div>
                            <Separator className="my-2 border-black" />
                            <TransactionReceipt transaction={selectedTransaction} />
                        </Card>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isEditContactOpen} onOpenChange={setIsEditContactOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader><DialogTitle>Modifier les coordonnées</DialogTitle></DialogHeader>
                    <Form {...contactForm}>
                        <form onSubmit={contactForm.handleSubmit(handleUpdateContact)} className="space-y-4 py-4">
                            <FormField control={contactForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input {...field} className="bg-zinc-800 border-zinc-700"/></FormControl></FormItem> )}/>
                            <FormField control={contactForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} className="bg-zinc-800 border-zinc-700"/></FormControl></FormItem> )}/>
                            <FormField control={contactForm.control} name="adminPin" render={({ field }) => (
                                <FormItem><FormLabel className="text-center block">PIN Admin pour confirmer</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                            )}/>
                            <DialogFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Mettre à jour</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader><DialogTitle>Dépôt Souverain (Sans Frais)</DialogTitle></DialogHeader>
                    <Form {...depositForm}>
                        <form onSubmit={depositForm.handleSubmit(handleSovereignDeposit)} className="space-y-4 py-4">
                            <FormField control={depositForm.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} className="bg-zinc-800 border-zinc-700"/></FormControl></FormItem> )}/>
                            <FormField control={depositForm.control} name="currency" render={({ field }) => (
                                <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger></FormControl><SelectContent className="bg-zinc-800 text-white"><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="CDF">CDF</SelectItem></SelectContent></Select></FormItem>
                            )}/>
                            <FormField control={depositForm.control} name="adminPin" render={({ field }) => (
                                <FormItem><FormLabel className="text-center block">PIN Super Agent</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                            )}/>
                            <DialogFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirmer le dépôt</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isSuspensionDialogOpen} onOpenChange={setIsSuspensionDialogOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-red-500">Suspendre l'utilisateur</DialogTitle>
                        <DialogDescription>Cette action bloquera l'accès à l'application pour {selectedUser?.full_name}.</DialogDescription>
                    </DialogHeader>
                    <Form {...suspensionForm}>
                        <form onSubmit={suspensionForm.handleSubmit(handleConfirmSuspension)} className="space-y-4 py-4">
                            <FormField control={suspensionForm.control} name="reason" render={({field}) => (
                                <FormItem>
                                    <FormLabel>Motif du blocage (sera affiché au client)</FormLabel>
                                    <FormControl><Textarea placeholder="Ex: Activités suspectes détectées, Dossier KYC incomplet..." {...field} className="bg-zinc-800 border-zinc-700"/></FormControl>
                                    <FormMessage/>
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsSuspensionDialogOpen(false)}>Annuler</Button>
                                <Button type="submit" variant="destructive" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Suspendre définitivement</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isBusinessUpgradeOpen} onOpenChange={setIsBusinessUpgradeOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Surclassement Entreprise & API</DialogTitle>
                        <DialogDescription>Transformez ce compte en Compte Entreprise. L'identité du compte sera remplacée par le nom commercial.</DialogDescription>
                    </DialogHeader>
                    <Form {...businessUpgradeForm}>
                        <form onSubmit={businessUpgradeForm.handleSubmit(handleBusinessUpgrade)} className="space-y-6 py-4">
                            <Alert className="bg-primary/10 border-primary/20">
                                <Building className="h-4 w-4 text-primary"/>
                                <AlertTitle>Changement d'Identité</AlertTitle>
                                <AlertDescription className="text-xs text-zinc-400">Le nom de l'utilisateur sur le réseau deviendra le nom de l'entreprise saisi ci-dessous.</AlertDescription>
                            </Alert>
                            
                            <FormField control={businessUpgradeForm.control} name="companyName" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nom Officiel de l'Entreprise</FormLabel>
                                    <FormControl><Input placeholder="Ex: SARL Ma Boutique" {...field} className="bg-zinc-800 border-zinc-700"/></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>

                            <FormField control={businessUpgradeForm.control} name="pin" render={({field}) => (
                                <FormItem><FormLabel className="text-center block font-bold">PIN Super Agent pour valider</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl></FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="animate-spin mr-2 h-4 w-4"/>} Activer le Mode Entreprise
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
