'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { createOpenMeeting, getMyRecentMeetings } from '@/lib/actions/meeting.actions';
import { ArrowLeft, Phone, Video } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type RecentMeeting = { code: string; topic: string; type: string; status: string; createdAt: string | null };

export function CallsView({ onBack }: { onBack: () => void }) {
    const router = useRouter();
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [meetings, setMeetings] = useState<RecentMeeting[] | null>(null);

    useEffect(() => { getMyRecentMeetings().then(setMeetings); }, []);

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
                    {meetings === null && <p className="p-6 text-center text-sm text-zinc-500">Chargement…</p>}
                    {meetings && meetings.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">Aucune réunion pour le moment. Créez-en une ci-dessus.</p>}
                    {meetings?.map(m => (
                        <div key={m.code} className="flex items-center gap-4 p-2 rounded-lg hover:bg-zinc-800">
                            <div className="h-12 w-12 rounded-full bg-zinc-700 flex items-center justify-center text-green-500">
                                {m.type === 'audio' ? <Phone /> : <Video />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{m.topic}</p>
                                <p className="text-sm text-zinc-400 truncate">
                                    {m.createdAt ? formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: fr }) : m.code}
                                </p>
                            </div>
                            {m.status === 'active' && (
                                <Button variant="secondary" size="sm" onClick={() => router.push(`/feedback/meet/${m.code}`)}>Rejoindre</Button>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
