
'use client';

import { useState } from 'react';
import type { User, Status, StatusGroup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';

const StatusListItem = ({ group, onClick }: { group: StatusGroup, onClick: () => void }) => (
    <div className="flex items-center gap-4 p-3 hover:bg-zinc-800 cursor-pointer" onClick={onClick}>
        <div className="relative p-1">
             <div className="absolute inset-0 rounded-full animated-status-ring"></div>
            <Avatar className="h-14 w-14 border-2 border-black">
                <AvatarImage src={group.contact.profile_photo || ''} alt={group.contact.full_name} />
                <AvatarFallback>{group.contact.full_name[0]}</AvatarFallback>
            </Avatar>
        </div>
        <div>
            <p className="font-semibold text-white">{group.contact.full_name}</p>
            <p className="text-sm text-zinc-400">Il y a 30 minutes</p>
        </div>
    </div>
);

export function StatusView({ onBack, onViewStatus, currentUser, statusGroups }: { onBack: () => void; onViewStatus: (groupIndex: number) => void; currentUser: User | null, statusGroups: StatusGroup[] }) {
    const myStatusGroup = statusGroups.find(g => g.contact.id === currentUser?.id);
    const contactStatusGroups = statusGroups.filter(g => g.contact.id !== currentUser?.id);

    return (
        <div className="flex flex-col h-full min-h-0 bg-[#0D1226]">
            <header className="flex items-center p-2 sm:p-3 shrink-0 bg-[#141C38] text-white">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft />
                </Button>
                <h2 className="font-bold text-base ml-4">Statut</h2>
            </header>

            <div className="flex-1 overflow-y-auto p-2">
                <div className="relative p-3 flex items-center gap-4 cursor-pointer" onClick={() => myStatusGroup && onViewStatus(statusGroups.indexOf(myStatusGroup))}>
                     <Avatar className="h-14 w-14">
                        <AvatarImage src={currentUser?.profile_photo || ''} alt={currentUser?.full_name} />
                        <AvatarFallback>{currentUser?.first_name?.[0]}</AvatarFallback>
                    </Avatar>
                     <div>
                        <p className="font-semibold text-white">Mon Statut</p>
                        <p className="text-sm text-zinc-400">Appuyez pour ajouter une mise à jour</p>
                    </div>
                     <Link href="/status/create" className="absolute -bottom-1 left-12" onClick={e => e.stopPropagation()}>
                        <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-[#0D1226]">
                            <Camera className="h-3 w-3 text-white" />
                        </div>
                    </Link>
                </div>

                <p className="text-sm font-semibold text-zinc-400 px-3 py-4">Récentes</p>

                <div className="space-y-1">
                    {contactStatusGroups.map((group, index) => (
                        <StatusListItem key={group.contact.id} group={group} onClick={() => onViewStatus(statusGroups.indexOf(group))} />
                    ))}
                </div>
            </div>

             <Link href="/status/create?type=text" className="absolute bottom-24 right-4">
                <div className="h-14 w-14 rounded-2xl bg-zinc-700 flex items-center justify-center shadow-lg">
                    <Pencil className="h-6 w-6 text-white"/>
                </div>
            </Link>
             <Link href="/status/create?type=media" className="absolute bottom-6 right-4">
                <div className="h-14 w-14 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                    <Camera className="h-6 w-6 text-white"/>
                </div>
            </Link>
        </div>
    );
}
