
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, DollarSign, Eye } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { createLoanMeGroup, addMemberToGroup, getGroupMembers } from '@/lib/actions/loanme.actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InternationalWalletInput } from '../shared/international-wallet-input';
import type { WalletInfo } from '@/lib/actions/wallet.actions';
import { useTranslation } from 'react-i18next';


const createGroupSchema = z.object({
  groupName: z.string().min(3, "Le nom du groupe est requis."),
});

const addMemberSchema = z.object({
  walletId: z.string().min(12, "L'ID du portefeuille est requis."),
});

const GroupCard = ({ group, onAddMember, onViewMembers }: { group: any, onAddMember: (groupId: number) => void, onViewMembers: (group: any) => void }) => {
    const { t } = useTranslation();
    return (
    <Card>
        <CardHeader>
            <CardTitle>{group.group_name}</CardTitle>
            <CardDescription>{group.member_count} {t('membersLabel', 'Membre(s)')} • {t('statusLabel', 'Statut')}: {group.status}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onAddMember(group.id)}>{t('addMemberButton', 'Ajouter un Membre')}</Button>
            <Button variant="outline" size="sm" onClick={() => onViewMembers(group)}><Eye className="mr-2 h-4 w-4"/>{t('viewMembersButton', 'Voir les Membres')}</Button>
            <Button size="sm" disabled={group.status !== 'open'}>{t('requestLoanButton', 'Demander un Prêt')}</Button>
        </CardContent>
    </Card>
)};

export function LoanMePartnerDashboard({ partner }: { partner: any }) {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const [groups, setGroups] = useState(partner.groups || []);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [isViewMembersOpen, setIsViewMembersOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
    const [groupMembers, setGroupMembers] = useState<any[]>([]);

    const createGroupForm = useForm<z.infer<typeof createGroupSchema>>({
        resolver: zodResolver(createGroupSchema),
        defaultValues: { groupName: '' },
    });
    
    const addMemberForm = useForm<z.infer<typeof addMemberSchema>>({
        resolver: zodResolver(addMemberSchema),
        defaultValues: { walletId: '' },
    });

    const handleCreateGroup = async (values: z.infer<typeof createGroupSchema>) => {
        const result = await createLoanMeGroup(partner.id, values.groupName);
        if (result.success && result.group) {
            setGroups([...groups, { ...result.group, member_count: 0 }]);
            setIsCreateGroupOpen(false);
            createGroupForm.reset();
        } else {
            openAlert({ title: t('errorTitle'), description: result.error, variant: 'error' });
        }
    };
    
    const handleAddMember = async (values: z.infer<typeof addMemberSchema>) => {
        if (!selectedGroup) return;
        const result = await addMemberToGroup(selectedGroup.id, values.walletId);
        if(result.success) {
            setIsAddMemberOpen(false);
            addMemberForm.reset();
             openAlert({title: t('successTitle'), description: t('mlmLoanMeMemberAdded'), variant: 'success'});
            // Refresh group list
             setGroups(groups.map(g => g.id === selectedGroup.id ? {...g, member_count: g.member_count + 1} : g));
        } else {
             openAlert({title: t('errorTitle'), description: result.error, variant: 'error'});
        }
    }
    
    const handleViewMembers = async (group: any) => {
        setSelectedGroup(group);
        const members = await getGroupMembers(group.id);
        setGroupMembers(members);
        setIsViewMembersOpen(true);
    }
    
    const totalCommissions = partner.commissions.reduce((sum: number, c: any) => sum + parseFloat(c.commission_amount), 0);

    return (
        <div className="space-y-6">
            <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{t('mlmLoanMeCreateGroupTitle')}</DialogTitle></DialogHeader>
                    <Form {...createGroupForm}><form onSubmit={createGroupForm.handleSubmit(handleCreateGroup)} className="space-y-4">
                        <FormField control={createGroupForm.control} name="groupName" render={({ field }) => ( <FormItem> <FormLabel>{t('mlmLoanMeGroupNameLabel')}</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage/> </FormItem> )} />
                        <DialogFooter><Button type="submit">{t('createButton')}</Button></DialogFooter>
                    </form></Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                 <DialogContent>
                    <DialogHeader><DialogTitle>{t('mlmLoanMeAddMemberTo', { groupName: selectedGroup?.group_name })}</DialogTitle></DialogHeader>
                    <Form {...addMemberForm}><form onSubmit={addMemberForm.handleSubmit(handleAddMember)} className="space-y-4">
                        <FormField control={addMemberForm.control} name="walletId" render={({ field }) => ( <FormItem><InternationalWalletInput field={field} onVerificationResult={()=>{}} label={t('mlmLoanMeMemberWalletId')} /></FormItem> )}/>
                        <DialogFooter><Button type="submit">{t('addButton')}</Button></DialogFooter>
                    </form></Form>
                </DialogContent>
            </Dialog>
            
             <Dialog open={isViewMembersOpen} onOpenChange={setIsViewMembersOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>{t('mlmLoanMeGroupMembersTitle', { groupName: selectedGroup?.group_name })}</DialogTitle></DialogHeader>
                    <Table>
                        <TableHeader><TableRow><TableHead>{t('nameLabel')}</TableHead><TableHead>{t('walletIdLabel')}</TableHead><TableHead>{t('loanStatusLabel')}</TableHead></TableRow></TableHeader>
                        <TableBody>{groupMembers.map(m => <TableRow key={m.id}><TableCell>{m.full_name}</TableCell><TableCell>{m.id_wallet}</TableCell><TableCell>{m.loan_id ? t('activeStatus') : 'N/A'}</TableCell></TableRow>)}</TableBody>
                    </Table>
                </DialogContent>
            </Dialog>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users/>{t('groupsLabel')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">{groups.length}</p>
                        <p className="text-sm text-muted-foreground">{t('groupsCreatedLabel')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><DollarSign/>{t('commissionsLabel')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">${totalCommissions.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{t('totalCommissionsEarnedLabel')}</p>
                    </CardContent>
                </Card>
            </div>
            
             <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                        <CardTitle>{t('myGroupsTitle')}</CardTitle>
                        <CardDescription>{t('myGroupsDescription')}</CardDescription>
                    </div>
                    <Button onClick={() => setIsCreateGroupOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> {t('createGroupButton')}</Button>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                    {groups.map((group: any) => (
                        <GroupCard key={group.id} group={group} onAddMember={() => { setSelectedGroup(group); setIsAddMemberOpen(true); }} onViewMembers={handleViewMembers} />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
