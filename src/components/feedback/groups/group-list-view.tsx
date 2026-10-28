

'use client';

import { useState, useEffect } from 'react';
import type { Group, User } from '@/lib/types';
import { getUserGroups } from '@/lib/actions/group.actions';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface GroupListViewProps {
    currentUser: User;
    onBack: () => void;
    onCreateGroup: () => void;
    onSelectGroup: (groupId: number) => void;
}

const GroupItem = ({ group, onClick }: { group: Group; onClick: (groupId: number) => void }) => (
    <div className="flex items-center gap-4 p-2 rounded-lg hover:bg-zinc-800 cursor-pointer" onClick={() => onClick(group.id)}>
        <Avatar className="h-12 w-12">
            <AvatarImage src={group.photo_url || ''} />
            <AvatarFallback>{group.name.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 border-t border-zinc-700/50 py-3">
            <p className="font-semibold text-white truncate">{group.name}</p>
            <p className="text-sm text-zinc-400">{group.member_count} membre(s)</p>
        </div>
    </div>
);

export function GroupListView({ currentUser, onBack, onCreateGroup, onSelectGroup }: GroupListViewProps) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchGroups = async () => {
            setIsLoading(true);
            const userGroups = await getUserGroups(currentUser.id);
            setGroups(userGroups);
            setIsLoading(false);
        };
        fetchGroups();
    }, [currentUser.id]);

    const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col h-full min-h-0 bg-[#0D1226] text-white">
            <header className="flex items-center p-2 sm:p-3 shrink-0 bg-[#141C38] border-b border-zinc-700/50">
                <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>
                <h2 className="font-bold text-lg ml-4">Groupes</h2>
                <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={onCreateGroup}><PlusCircle /></Button>
                </div>
            </header>
            <div className="p-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                    <Input
                        placeholder="Rechercher un groupe..."
                        className="pl-10 bg-zinc-800 border-zinc-700 h-10 rounded-lg"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 pb-16">
                <div className="p-2 space-y-1">
                    {isLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-zinc-400" /></div> : filteredGroups.length > 0 ? (
                        filteredGroups.map(group => (
                            <GroupItem key={group.id} group={group} onClick={onSelectGroup} />
                        ))
                    ) : (
                        <div className="text-center py-16 text-zinc-500">
                            <p>Aucun groupe trouvé.</p>
                            <p className="text-sm">Créez un groupe pour commencer.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
