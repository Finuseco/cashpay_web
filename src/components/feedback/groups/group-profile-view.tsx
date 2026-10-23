
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User, Group, GroupTransaction, Currency } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, UserPlus, Trash2, Crown, Shield, Banknote, Upload, Loader2, Edit, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { addMemberToGroup, removeMemberFromGroup, getGroupTransactions, contributeToGroup, payoutFromGroup } from '@/lib/actions/group.actions';
import { InternationalWalletInput } from '@/components/shared/international-wallet-input';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import Image from 'next/image';

const addMemberSchema = z.object({
  walletId: z.string().min(12, "L'ID du portefeuille est requis."),
});

const contributionSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être positif."),
  currency: z.string(),
  pin: z.string().length(4, "Le PIN est requis."),
});

const payoutSchema = z.object({
    destinationType: z.enum(['wallet', 'mobile_money']),
    destinationWalletId: z.string().optional(),
    mobilePhone: z.string().optional(),
    mobileOperator: z.string().optional(),
    amount: z.coerce.number().positive("Le montant doit être positif."),
    description: z.string().min(3, "Une description est requise."),
    pin: z.string().length(4, "Le PIN de l'admin est requis."),
}).refine(data => data.destinationType === 'wallet' ? !!data.destinationWalletId : (!!data.mobilePhone && !!data.mobileOperator), {
    message: "Destination invalide.",
    path: ["destinationWalletId"]
});


export function GroupProfileView({ group, currentUser, onBack, onGroupUpdate }: { group: Group, currentUser: User, onBack: () => void, onGroupUpdate: () => void }) {
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [isContributionOpen, setIsContributionOpen] = useState(false);
    const [isPayoutOpen, setIsPayoutOpen] = useState(false);
    const [transactions, setTransactions] = useState<GroupTransaction[]>([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [userCurrencies, setUserCurrencies] = useState<Currency[]>([]);

    const { openAlert } = useAlertDialog();
    const { toast } = useToast();

    useEffect(() => {
        const fetchCurrencies = async () => {
            const c = await getUserCurrencies(currentUser.id);
            setUserCurrencies(c);
        };
        fetchCurrencies();
    }, [currentUser.id]);
    
    useEffect(() => {
        const fetchTransactions = async () => {
            setIsLoadingTransactions(true);
            const fetchedTransactions = await getGroupTransactions(group.id);
            setTransactions(fetchedTransactions);
            setIsLoadingTransactions(false);
        };
        fetchTransactions();
    }, [group.id]);

    const addMemberForm = useForm<z.infer<typeof addMemberSchema>>({
        resolver: zodResolver(addMemberSchema),
        defaultValues: { walletId: '' },
    });

    const contributionForm = useForm<z.infer<typeof contributionSchema>>({
        resolver: zodResolver(contributionSchema),
        defaultValues: { currency: group.currency, amount: 10, pin: '' }
    });
    
    const payoutForm = useForm<z.infer<typeof payoutSchema>>({
        resolver: zodResolver(payoutSchema),
        defaultValues: { destinationType: 'wallet', amount: undefined, description: '', destinationWalletId: '', mobilePhone: '', mobileOperator: 'mpesa', pin: '' },
    });

    const currentUserRole = group.members.find(m => m.id === currentUser.id)?.role;
    const isCurrentUserAdmin = currentUserRole === 'admin';

    const handleAddMember = async (values: z.infer<typeof addMemberSchema>) => {
        const result = await addMemberToGroup(group.id, currentUser.id, values.walletId);
        if (result.success) {
            toast({ title: "Membre ajouté", description: "Le membre a été ajouté au groupe avec succès.", variant: "success" });
            onGroupUpdate();
            setIsAddMemberOpen(false);
            addMemberForm.reset();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: "error" });
        }
    };
    
    const handleRemoveMember = (memberId: number) => {
        openAlert({
            title: "Confirmer la suppression",
            description: "Êtes-vous sûr de vouloir supprimer ce membre du groupe ?",
            variant: "warning",
            onClose: async (confirmed) => {
                if (confirmed) {
                    const result = await removeMemberFromGroup(group.id, currentUser.id, memberId);
                    if (result.success) {
                        toast({ title: "Membre supprimé", variant: "success" });
                        onGroupUpdate();
                    } else {
                        openAlert({ title: "Erreur", description: result.error, variant: "error" });
                    }
                }
            }
        });
    };
    
    const handleContribute = async (values: z.infer<typeof contributionSchema>) => {
        const result = await contributeToGroup({ userId: currentUser.id, groupId: group.id, amount: values.amount, currency: values.currency, pin: values.pin });
        if (result.success) {
            toast({ title: "Contribution réussie", description: `${values.amount} ${values.currency} ont été ajoutés au groupe.` });
            setIsContributionOpen(false);
            onGroupUpdate();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: "error" });
        }
    };
    
    const handlePayout = async (values: z.infer<typeof payoutSchema>) => {
        const result = await payoutFromGroup({ 
            adminUserId: currentUser.id, 
            groupId: group.id, 
            amount: values.amount, 
            pin: values.pin, 
            destinationWalletId: values.destinationType === 'wallet' ? values.destinationWalletId : undefined,
            destinationMobile: values.destinationType === 'mobile_money' ? { phone: values.mobilePhone!, operator: values.mobileOperator! } : undefined,
            description: values.description 
        });
         if (result.success) {
            toast({ title: "Paiement réussi", description: `${values.amount} ${group.currency} envoyés.` });
            setIsPayoutOpen(false);
            onGroupUpdate();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: "error" });
        }
    };

    const watchDestType = payoutForm.watch('destinationType');

    return (
        <div className="flex flex-col h-full min-h-0 bg-[#0b141a] text-white">
            {/* Dialogs */}
            <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}><DialogContent><DialogHeader><DialogTitle>Ajouter un Membre</DialogTitle><DialogDescription>Entrez l'ID du portefeuille du membre à ajouter.</DialogDescription></DialogHeader><Form {...addMemberForm}><form onSubmit={addMemberForm.handleSubmit(handleAddMember)} className="space-y-4 pt-4"><FormField control={addMemberForm.control} name="walletId" render={({ field }) => ( <FormItem><InternationalWalletInput field={field} onVerificationResult={()=>{}} label="ID du Portefeuille" /></FormItem> )}/><DialogFooter><Button type="submit">Ajouter</Button></DialogFooter></form></Form></DialogContent></Dialog>
            <Dialog open={isContributionOpen} onOpenChange={setIsContributionOpen}><DialogContent><DialogHeader><DialogTitle>Contribuer au Groupe</DialogTitle></DialogHeader><Form {...contributionForm}><form onSubmit={contributionForm.handleSubmit(handleContribute)} className="space-y-4 pt-4"><FormField control={contributionForm.control} name="amount" render={({field}) => (<FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage/></FormItem>)}/><FormField control={contributionForm.control} name="currency" render={({field}) => (<FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{userCurrencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code} (Solde: {c.balance})</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/><FormField control={contributionForm.control} name="pin" render={({field}) => (<FormItem><FormLabel>Votre PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/><DialogFooter><Button type="submit">Contribuer</Button></DialogFooter></form></Form></DialogContent></Dialog>
            
            <Dialog open={isPayoutOpen} onOpenChange={setIsPayoutOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Paiement depuis le Groupe</DialogTitle><DialogDescription>Montant disponible : {group.balance.toFixed(2)} {group.currency}</DialogDescription></DialogHeader>
                    <Form {...payoutForm}>
                        <form onSubmit={payoutForm.handleSubmit(handlePayout)} className="space-y-4 pt-4">
                            <FormField control={payoutForm.control} name="destinationType" render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Destination</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                                            <div className={cn("flex items-center space-x-2 border p-3 rounded-lg cursor-pointer", field.value === 'wallet' && "border-primary")}>
                                                <RadioGroupItem value="wallet" id="dest-wallet" />
                                                <Label htmlFor="dest-wallet" className="flex items-center gap-2 cursor-pointer"><Banknote className="h-4 w-4"/> CashPay</Label>
                                            </div>
                                            <div className={cn("flex items-center space-x-2 border p-3 rounded-lg cursor-pointer", field.value === 'mobile_money' && "border-primary")}>
                                                <RadioGroupItem value="mobile_money" id="dest-momo" />
                                                <Label htmlFor="dest-momo" className="flex items-center gap-2 cursor-pointer"><Smartphone className="h-4 w-4"/> Mobile</Label>
                                            </div>
                                        </RadioGroup>
                                    </FormControl>
                                </FormItem>
                            )}/>

                            {watchDestType === 'wallet' ? (
                                <FormField control={payoutForm.control} name="destinationWalletId" render={({field}) => (<FormItem><InternationalWalletInput field={field} onVerificationResult={()=>{}} label="ID Portefeuille du Destinataire" /></FormItem>)}/>
                            ) : (
                                <div className="space-y-4">
                                    <FormField control={payoutForm.control} name="mobileOperator" render={({field}) => (
                                        <FormItem><FormLabel>Opérateur</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Opérateur"/></SelectTrigger></FormControl><SelectContent><SelectItem value="airtel">Airtel Money</SelectItem><SelectItem value="mpesa">M-Pesa</SelectItem><SelectItem value="mtn">MTN MoMo</SelectItem></SelectContent></Select></FormItem>
                                    )}/>
                                    <FormField control={payoutForm.control} name="mobilePhone" render={({field}) => (<FormItem><FormLabel>Numéro Mobile Money</FormLabel><FormControl><Input placeholder="08..." {...field}/></FormControl></FormItem>)}/>
                                </div>
                            )}

                            <FormField control={payoutForm.control} name="amount" render={({field}) => (<FormItem><FormLabel>Montant ({group.currency})</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                            <FormField control={payoutForm.control} name="description" render={({field}) => (<FormItem><FormLabel>Motif</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>)}/>
                            <FormField control={payoutForm.control} name="pin" render={({field}) => (<FormItem><FormLabel>Votre PIN d'Admin</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl></FormItem>)}/>
                            <DialogFooter><Button type="submit" variant="gradient" className="w-full h-12 font-bold">Confirmer le Paiement</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <header className="flex items-center p-2 sm:p-3 shrink-0 bg-[#1f2c33]"><Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button><h2 className="font-semibold text-lg ml-4">Infos du groupe</h2></header>

            <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 flex flex-col items-center">
                    <div className="relative group cursor-pointer">
                        <Avatar className="h-28 w-28 mb-4 border-2 border-primary">
                            <AvatarImage src={group.photo_url || ''} />
                            <AvatarFallback className="text-3xl">{group.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        {isCurrentUserAdmin && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Edit className="h-6 w-6"/></div>}
                    </div>
                    <h1 className="text-2xl font-bold">{group.name}</h1>
                    <p className="text-zinc-400">Portefeuille Groupe : <span className="font-mono text-xs text-primary">{group.group_wallet_id}</span></p>
                    <div className="mt-2 text-center p-2 bg-zinc-800 rounded-lg">
                        <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Solde Disponible</p>
                        <p className="text-xl font-black text-white">{group.balance.toFixed(2)} {group.currency}</p>
                    </div>
                </div>
                <div className="px-6 text-center text-sm text-zinc-300"><p className="italic">{group.description || "Aucune description fournie pour ce groupe."}</p></div>

                <div className="p-4 grid grid-cols-2 gap-4">
                    <Button variant="outline" className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 h-12 font-bold" onClick={() => setIsContributionOpen(true)}><Upload className="mr-2 h-4 w-4"/>Contribuer</Button>
                    {isCurrentUserAdmin && <Button variant="outline" className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 h-12 font-bold" onClick={() => setIsPayoutOpen(true)}><Banknote className="mr-2 h-4 w-4"/>Décaissement</Button>}
                </div>

                <div className="p-4 mt-4">
                    <Tabs defaultValue="members" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-zinc-800 h-12">
                            <TabsTrigger value="members">Membres</TabsTrigger>
                            <TabsTrigger value="transactions">Finances</TabsTrigger>
                        </TabsList>
                        <TabsContent value="members" className="mt-4 bg-[#1f2c33] rounded-lg p-4 space-y-3">
                            {isCurrentUserAdmin && (<button onClick={() => setIsAddMemberOpen(true)} className="flex items-center gap-3 p-3 w-full text-left hover:bg-zinc-700 rounded-lg border border-dashed border-zinc-600 transition-all"><div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center"><UserPlus className="h-5 w-5"/></div><p className="font-bold">Ajouter un membre</p></button>)}
                            {group.members.map(member => (
                                <div key={member.id} className="flex items-center gap-3 p-2 hover:bg-zinc-800/50 rounded-lg">
                                    <Avatar className="h-10 w-10 border border-zinc-700"><AvatarImage src={member.profile_photo || ''} /><AvatarFallback>{member.full_name.slice(0, 2)}</AvatarFallback></Avatar>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{member.full_name}</p>
                                        {member.role === 'admin' && <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 bg-yellow-400/5 h-4 text-[8px] font-black uppercase"><Crown className="h-2 w-2 mr-1"/>Fondateur</Badge>}
                                    </div>
                                    {isCurrentUserAdmin && currentUser.id !== member.id && (<Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 hover:text-red-400" onClick={() => handleRemoveMember(member.id)}><Trash2 className="h-4 w-4"/></Button>)}
                                </div>
                            ))}
                        </TabsContent>
                        <TabsContent value="transactions" className="mt-4 bg-[#1f2c33] rounded-lg p-0 overflow-hidden">
                            {isLoadingTransactions ? <div className="text-center p-8"><Loader2 className="animate-spin h-6 w-6 mx-auto text-zinc-500"/></div> :
                             transactions.length > 0 ? (
                                <Table><TableHeader className="bg-black/20"><TableRow className="border-zinc-700"><TableHead className="text-[10px]">Date</TableHead><TableHead className="text-[10px]">Opération</TableHead><TableHead className="text-right text-[10px]">Montant</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {transactions.map(tx => (
                                        <TableRow key={tx.id} className="border-zinc-700 hover:bg-zinc-800/50">
                                            <TableCell className="text-[9px] text-zinc-500">{format(new Date(tx.created_at), 'dd/MM HH:mm')}</TableCell>
                                            <TableCell className="text-[10px]">
                                                <p className="font-bold capitalize">{tx.type}</p>
                                                <p className="text-zinc-500 truncate max-w-[120px]">{tx.description}</p>
                                            </TableCell>
                                            <TableCell className={cn("text-right font-black text-xs", tx.type === 'contribution' ? 'text-green-500' : 'text-red-400')}>
                                                {tx.type === 'contribution' ? '+' : '-'} {tx.amount.toFixed(2)} {tx.currency}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                </Table>
                             ) : <p className="text-center text-zinc-500 text-xs py-10 italic">Aucun mouvement financier enregistré.</p>
                            }
                        </TabsContent>
                    </Tabs>
                </div>
                
                 <div className="p-4 pb-20"><Button variant="ghost" className="w-full text-red-400 hover:bg-red-400/10 h-12">Quitter le groupe définitivement</Button></div>
            </ScrollArea>
        </div>
    );
}
