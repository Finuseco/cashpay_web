'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Video, ShieldCheck, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MeetInterface } from '@/components/feedback/meet-interface';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { User } from '@/lib/types';
type Quote = { totalDebit: number; fee: number; balance: number; currency: string; priceAmount: number; priceCurrency: string; sufficientBalance: boolean; isHost: boolean; alreadyPaid: boolean; requiresTicket: boolean; eventId: number | null };
export default function MeetPage() {
    const params = useParams<{ code: string }>(); const search = useSearchParams(); const router = useRouter();
    const code = String(params?.code || '');
    const [user, setUser] = useState<User | null>(null); const [entered, setEntered] = useState(false);
    const [topic, setTopic] = useState(''); const [quote, setQuote] = useState<Quote | null>(null);
    const [withVideo, setWithVideo] = useState(true); const [currency, setCurrency] = useState('');
    const [pin, setPin] = useState(''); const [ticketCode, setTicketCode] = useState(search.get('ticket') || '');
    const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
    useEffect(() => { let active = true; setLoading(true); setError(''); setQuote(null);
        (async () => {
            const me = await getAuthenticatedUser(); if (!active) return;
            setUser(me); if (!me) return;
            const response = await fetch(`/api/v1/meetings/${encodeURIComponent(code)}/billing?currency=${encodeURIComponent(currency)}`, { cache: 'no-store' });
            const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || 'Réunion indisponible.');
            if (active) { setQuote(result.quote); setTopic(result.topic); }
        })().catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [code, currency]);
    async function join() {
        if (!quote) return; setBusy(true); setError('');
        try {
            const response = await fetch(`/api/v1/meetings/${encodeURIComponent(code)}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, currency: quote.currency, maxDebit: quote.totalDebit, consent: true, ticketCode }) });
            const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || 'Admission refusée.');
            setPin(''); setEntered(true);
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }
    if (entered && user && quote) return <MeetInterface meetCode={code} user={user} withVideo={withVideo} isHost={quote.isHost} />;
    return <main className="h-[100dvh] overflow-y-auto bg-background text-foreground p-4 md:p-10 flex items-center justify-center"><div className="w-full max-w-3xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden grid md:grid-cols-2"><div className="p-8 text-white flex flex-col justify-between gap-8" style={{ background: 'linear-gradient(145deg,#562EBF,#1F62D5)' }}><div><Video className="h-10 w-10 text-[#44BBF5]" /><p className="text-sm mt-6 text-white/70">OnChat Meet</p><h1 className="font-bold text-3xl mt-2">{topic || 'Bienvenue dans votre réunion'}</h1></div><p className="text-sm text-white/70">Échangez, apprenez et partagez la scène. Vous gardez le contrôle de votre participation.</p></div><section className="p-6 md:p-8 space-y-4">
        {loading ? <Loader2 className="animate-spin" aria-label="Chargement" /> : !user ? <><p>Connectez-vous pour rejoindre cette réunion.</p><Button onClick={() => router.push('/feedback/login')}>Se connecter</Button></> : quote ? <>
            <h2 className="font-semibold text-xl">{quote.isHost ? 'Espace organisateur' : 'Votre participation'}</h2><div className="flex gap-2"><Button variant={withVideo ? 'default' : 'outline'} onClick={() => setWithVideo(true)}>Vidéo</Button><Button variant={!withVideo ? 'default' : 'outline'} onClick={() => setWithVideo(false)}>Audio</Button></div>
            {quote.requiresTicket ? <div className="space-y-3"><p className="text-sm flex gap-2"><Ticket className="h-5 w-5 text-secondary" />Un billet personnel est nécessaire pour entrer.</p><Label htmlFor="ticket-code">Code de participation</Label><Input id="ticket-code" value={ticketCode} onChange={e => setTicketCode(e.target.value)} autoComplete="off" /><Button variant="outline" onClick={() => router.push(`/events/${quote.eventId}`)}>Acheter un billet</Button></div> : quote.totalDebit > 0 ? <>
                <p className="text-sm">Tarif : {quote.priceAmount} {quote.priceCurrency}</p><Label htmlFor="debit-currency">Devise de paiement</Label><Input id="debit-currency" placeholder={quote.priceCurrency} defaultValue={quote.currency} maxLength={10} onBlur={e => setCurrency(e.target.value.toUpperCase())} />
                <dl className="rounded-xl bg-background p-4 text-sm space-y-2"><div className="flex justify-between"><dt>Frais CashPay</dt><dd>{quote.fee} {quote.currency}</dd></div><div className="flex justify-between font-bold"><dt>Total à débiter</dt><dd>{quote.totalDebit} {quote.currency}</dd></div><div className="flex justify-between"><dt>Solde disponible</dt><dd>{quote.balance} {quote.currency}</dd></div></dl>
                {!quote.sufficientBalance && <p role="alert" className="text-red-400 text-sm">Solde insuffisant. Rechargez votre portefeuille ou choisissez une autre devise.</p>}<Label htmlFor="payment-pin">PIN CashPay pour autoriser le débit</Label><Input id="payment-pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value)} maxLength={12} /><p className="text-xs text-muted-foreground">En confirmant, vous autorisez ce débit pour créditer l’organisateur. Une reconnexion ne déclenche pas de second paiement.</p>
            </> : <p className="text-sm text-muted-foreground">{quote.isHost ? 'Gérez les participants, les demandes de parole et vos revenus depuis le panneau organisateur.' : quote.alreadyPaid ? 'Votre participation a déjà été réglée.' : 'Participation gratuite.'}</p>}
            <Button className="w-full onchat-btn-primary" onClick={join} disabled={busy || (!quote.requiresTicket && quote.totalDebit > 0 && (!quote.sufficientBalance || !pin)) || (quote.requiresTicket && !ticketCode.trim())}>{busy ? <Loader2 className="mr-2 animate-spin h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{quote.totalDebit > 0 ? 'Autoriser et rejoindre' : quote.isHost ? 'Ouvrir la réunion et gérer' : 'Rejoindre la réunion'}</Button>
        </> : null}{error && <p role="alert" className="text-red-400 text-sm">{error}</p>}<Button variant="ghost" onClick={() => router.push('/feedback')}>Retour à OnChat</Button>
    </section></div></main>;
}
