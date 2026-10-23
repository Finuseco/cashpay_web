'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createOpenMeeting } from '@/lib/actions/meeting.actions';
import { ArrowLeft, Phone, Video } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const mockCalls = [
    { id: 1, name: 'Jane Smith', avatar: '/avatars/contact-2.png', type: 'incoming', status: 'missed', time: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
    { id: 2, name: 'John Doe', avatar: '/avatars/contact-1.png', type: 'outgoing', status: 'answered', time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    { id: 3, name: 'Mike', avatar: '/avatars/contact-3.png', type: 'incoming', status: 'answered', time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
];

export function CallsView({ onBack }: { onBack: () => void }) {
    const router = useRouter();
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const createMeeting = async (type: 'audio' | 'video') => {
        setBusy(true); setErr('');
        const r = await createOpenMeeting({ type });
        setBusy(false);
        if (r.success) router.push(`/feedback/meet/${r.meetCode}`); else setErr(r.error);
    };
    const joinMeeting = () => {
        const m = code.trim().match(/([A-Za-z0-9_-]{4,64})\/?$/);
        if (m) router.push(`/feedback/meet/${m[1]}`); else setErr('Code ou lien invalide.');
    };

    return (
        <div className="flex flex-col h-full min-h-0 bg-[#111827] text-white">
            <header className="flex items-center p-2 sm:p-3 shrink-0 bg-[#1f2c33] border-b border-zinc-700/50">
                <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft /></Button>
                <h2 className="font-bold text-lg ml-4">Appels</h2>
            </header>
            <div className="shrink-0 p-3 space-y-2 border-b border-zinc-700/50">
                <div className="flex gap-2">
                    <Button className="flex-1" disabled={busy} onClick={() => createMeeting('video')}><Video className="mr-2 h-4 w-4" />Nouvelle réunion</Button>
                    <Button variant="outline" className="text-white" disabled={busy} onClick={() => createMeeting('audio')}><Phone className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2">
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code ou lien de réunion" className="bg-zinc-800 border-zinc-700" />
                    <Button variant="secondary" onClick={joinMeeting} disabled={!code.trim()}>Rejoindre</Button>
                </div>
                {err && <p className="text-xs text-red-400">{err}</p>}
            </div>
            <ScrollArea className="flex-1 min-h-0 pb-16">
                <div className="p-2 space-y-1">
                    {mockCalls.map(call => (
                        <div key={call.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-zinc-800">
                            <Avatar className="h-12 w-12">
                                <AvatarImage src={call.avatar} />
                                <AvatarFallback>{call.name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className={cn("font-semibold", call.status === 'missed' && 'text-red-500')}>{call.name}</p>
                                <p className="text-sm text-zinc-400 flex items-center gap-1">
                                    {call.type === 'incoming' ? 
                                        <ArrowLeft className={cn("h-4 w-4", call.status === 'missed' ? 'text-red-500' : 'text-green-500')} /> : 
                                        <ArrowLeft className="h-4 w-4 text-green-500 rotate-180" />
                                    }
                                    {formatDistanceToNow(new Date(call.time), { addSuffix: true, locale: fr })}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" className="text-green-500">
                                {call.type === 'video' ? <Video/> : <Phone />}
                            </Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
