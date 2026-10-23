'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MeetInterface } from '@/components/feedback/meet-interface';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { checkMeetingCode } from '@/lib/actions/meeting.actions';
import type { User } from '@/lib/types';

export default function MeetPage() {
    const params = useParams<{ code: string }>();
    const router = useRouter();
    const code = decodeURIComponent(String(params?.code || ''));
    const [user, setUser] = useState<User | null>(null);
    const [state, setState] = useState<'loading' | 'lobby' | 'in' | 'missing' | 'anon'>('loading');
    const [topic, setTopic] = useState('');
    const [withVideo, setWithVideo] = useState(true);

    useEffect(() => {
        (async () => {
            const [u, m] = await Promise.all([getAuthenticatedUser(), checkMeetingCode(code)]);
            if (!u) return setState('anon');
            setUser(u);
            if (!m.exists) return setState('missing');
            setTopic(m.topic || 'Réunion OnChat');
            setWithVideo(m.type !== 'audio');
            setState('lobby');
        })();
    }, [code]);

    if (state === 'in' && user) return <MeetInterface meetCode={code} user={user} withVideo={withVideo} />;

    return (
        <div className="h-[100dvh] flex items-center justify-center bg-[#0b0f1a] text-white p-6">
            <div className="max-w-sm w-full text-center space-y-4">
                {state === 'loading' && <Loader2 className="h-8 w-8 animate-spin mx-auto" />}
                {state === 'anon' && (<><p>Connectez-vous à OnChat pour rejoindre cette réunion.</p><Button onClick={() => router.push('/feedback/login')}>Se connecter</Button></>)}
                {state === 'missing' && (<><p>Réunion introuvable ou terminée.</p><Button onClick={() => router.push('/feedback')}>Retour</Button></>)}
                {state === 'lobby' && (
                    <>
                        <h1 className="text-xl font-bold">{topic}</h1>
                        <p className="text-sm text-zinc-400">Code : {code}</p>
                        <div className="flex gap-2 justify-center">
                            <Button variant={withVideo ? 'default' : 'outline'} onClick={() => setWithVideo(true)}>Avec caméra</Button>
                            <Button variant={!withVideo ? 'default' : 'outline'} onClick={() => setWithVideo(false)}>Audio seul</Button>
                        </div>
                        <Button className="w-full" onClick={() => setState('in')}>Rejoindre</Button>
                    </>
                )}
            </div>
        </div>
    );
}
