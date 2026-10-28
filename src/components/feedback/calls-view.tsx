'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getMyRecentMeetings } from '@/lib/actions/meeting.actions';
import { ArrowLeft, Video, Users, CalendarDays, ShieldCheck, Loader2 } from 'lucide-react';
type RecentMeeting = { code: string; topic: string; type: string; status: string; createdAt: string | null };
export function CallsView({ onBack }: { onBack: () => void }) {
    const router = useRouter();
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [meetings, setMeetings] = useState<RecentMeeting[]>([]);
    const [topic, setTopic] = useState('');
    const [type, setType] = useState('video');
    const [price, setPrice] = useState('0');
    const [currency, setCurrency] = useState('USD');
    const [scheduledAt, setScheduledAt] = useState('');
    useEffect(() => { getMyRecentMeetings().then(setMeetings).catch(() => setError('Impossible de charger vos réunions.')); }, []);
    async function create(event: React.FormEvent) {
        event.preventDefault(); setBusy(true); setError('');
        try {
            const response = await fetch('/api/v1/meetings/create', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, type, priceAmount: Number(price), priceCurrency: currency, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null }) });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Création impossible.');
            router.push(`/feedback/meet/${result.meetCode}`);
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }
    return <section className="h-full overflow-y-auto bg-background text-foreground pb-20">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 p-4 backdrop-blur"><Button variant="ghost" size="icon" onClick={onBack} aria-label="Retour"><ArrowLeft /></Button><div><h2 className="font-bold text-xl">OnChat Meet</h2><p className="text-xs text-muted-foreground">Votre espace de rencontres et de conférences</p></div></header>
        <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-6">
            <div className="rounded-3xl p-6 md:p-8 text-white" style={{ background: 'linear-gradient(120deg,#562EBF,#7F46D3,#1D8AE4)' }}><span className="text-xs uppercase tracking-widest">Ensemble, en direct</span><h1 className="text-2xl md:text-3xl font-bold mt-3">Une réunion à votre image.</h1><p className="mt-2 max-w-lg text-white/80">Audio ou vidéo, accès gratuit ou payant. Partagez une invitation et gérez votre communauté depuis votre espace organisateur.</p></div>
            <div className="grid gap-6 lg:grid-cols-2">
                <form onSubmit={create} className="rounded-2xl border border-border bg-card p-5 space-y-4"><h3 className="font-semibold flex gap-2"><Video className="text-secondary" />Créer une réunion</h3>
                    <div><Label htmlFor="meet-topic">Sujet</Label><Input id="meet-topic" value={topic} onChange={e => setTopic(e.target.value)} maxLength={120} placeholder="Conférence, formation, réunion d’équipe…" /></div>
                    <div><Label htmlFor="meet-mode">Format</Label><select id="meet-mode" value={type} onChange={e => setType(e.target.value)} className="w-full bg-background border border-border rounded-md p-2"><option value="video">Visioconférence</option><option value="audio">Salon audio</option></select></div>
                    <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="meet-price">Participation (0 = gratuit)</Label><Input id="meet-price" type="number" min="0" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} /></div><div><Label htmlFor="meet-currency">Devise du tarif</Label><Input id="meet-currency" value={currency} minLength={3} maxLength={10} required onChange={e => setCurrency(e.target.value.toUpperCase())} /></div></div>
                    <div><Label htmlFor="meet-date">Date prévue (facultatif)</Label><Input id="meet-date" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} /></div>
                    <p className="text-xs text-muted-foreground flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0" />Un accès payant exige la confirmation du participant avec son PIN. Les frais sont affichés avant paiement.</p>
                    <Button className="w-full onchat-btn-primary" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}Créer et gérer</Button>
                </form>
                <div className="space-y-5"><form className="rounded-2xl border border-border bg-card p-5 space-y-3" onSubmit={e => { e.preventDefault(); const match = code.trim().match(/([A-Za-z0-9_-]{4,64})\/?$/); if (match) router.push(`/feedback/meet/${match[1]}`); else setError('Invitation invalide.'); }}><h3 className="font-semibold">Vous avez une invitation ?</h3><Input value={code} onChange={e => setCode(e.target.value)} placeholder="Lien ou code de réunion" aria-label="Code de réunion" /><Button variant="secondary" disabled={!code.trim()} className="w-full">Accéder au salon d’accueil</Button></form>
                    <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold flex gap-2 mb-3"><CalendarDays className="h-5 w-5 text-secondary" />Vos réunions</h3>{meetings.length === 0 && <p className="text-sm text-muted-foreground">Vos réunions apparaîtront ici.</p>}{meetings.map(m => <button key={m.code} onClick={() => router.push(`/feedback/meet/${m.code}`)} className="text-left w-full rounded-xl p-3 hover:bg-muted flex items-center justify-between gap-3"><span className="truncate">{m.topic}</span><span className="text-xs text-muted-foreground">{m.status === 'active' ? 'Gérer' : 'Terminée'}</span></button>)}</div>
                </div>
            </div>{error && <p role="alert" className="text-red-400 border border-red-400/30 rounded-xl p-3">{error}</p>}
        </div>
    </section>;
}
