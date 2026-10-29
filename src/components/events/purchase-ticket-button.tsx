'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { User } from '@/lib/types';
import type { Event, TicketType } from '@/lib/actions/types';
type Quote = { totalDebit: number; fee: number; balance: number; currency: string; sufficientBalance: boolean };
export function PurchaseTicketButton({ event, ticketType, user }: { event: Event; ticketType: TicketType; user: User | null }) {
    const router = useRouter(); const [open, setOpen] = useState(false); const [quantity, setQuantity] = useState(1);
    const [currency, setCurrency] = useState(event.currency); const [quote, setQuote] = useState<Quote | null>(null);
    const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(false);
    useEffect(() => { if (!open || !user) return; let active = true; setQuote(null); setError('');
        fetch(`/api/v1/onchat/events/${event.id}/buy-ticket?ticketTypeId=${ticketType.id}&quantity=${quantity}&currency=${encodeURIComponent(currency)}`, { cache: 'no-store' })
            .then(async res => { const data = await res.json(); if (!res.ok || !data.success) throw new Error(data.error || 'Tarif indisponible.'); if (active) setQuote(data.quote); })
            .catch(e => { if (active) setError(e.message); }); return () => { active = false; };
    }, [open, user, quantity, currency, event.id, ticketType.id]);
    async function purchase() {
        if (!quote) return; setBusy(true); setError('');
        try {
            const response = await fetch(`/api/v1/onchat/events/${event.id}/buy-ticket`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketTypeId: ticketType.id, quantity, paymentCurrency: quote.currency, pin, maxDebit: quote.totalDebit, consent: true }) });
            const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || 'Achat refusé.');
            setPin(''); setSuccess(true); router.refresh();
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }
    const soldOut = ticketType.quantity <= ticketType.sold;
    return <><Button disabled={soldOut || event.eventType === 'zoom'} onClick={() => user ? setOpen(true) : router.push('/login')}>{soldOut ? 'Épuisé' : event.eventType === 'onchat' ? 'Acheter un code de participation' : 'Acheter un billet'}</Button>
        <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); setPin(''); } }}><DialogContent className="onchat-theme bg-card text-foreground"><DialogHeader><DialogTitle>{success ? 'Vos billets sont prêts' : event.name}</DialogTitle><DialogDescription>{success ? 'Retrouvez vos codes personnels dans Mes billets.' : 'Vérifiez le montant total avant de confirmer avec votre PIN.'}</DialogDescription></DialogHeader>
            {success ? <Button onClick={() => router.push('/events/my-tickets')}>Voir mes billets</Button> : <div className="space-y-4"><Label htmlFor={`qty-${ticketType.id}`}>Quantité (1 à 10)</Label><Input id={`qty-${ticketType.id}`} type="number" min={1} max={10} value={quantity} onChange={e => setQuantity(Number(e.target.value))} disabled={busy} /><Label htmlFor={`currency-${ticketType.id}`}>Devise de paiement</Label><Input id={`currency-${ticketType.id}`} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={10} disabled={busy} />
                {quote && <dl className="rounded-xl bg-background p-4 text-sm space-y-2"><div className="flex justify-between"><dt>Frais</dt><dd>{quote.fee} {quote.currency}</dd></div><div className="flex justify-between font-bold"><dt>Total</dt><dd>{quote.totalDebit} {quote.currency}</dd></div><div className="flex justify-between"><dt>Solde</dt><dd>{quote.balance} {quote.currency}</dd></div></dl>}
                {quote && !quote.sufficientBalance && <p className="text-red-400" role="alert">Solde insuffisant. Rechargez le portefeuille ou changez de devise.</p>}{quote && quote.totalDebit > 0 && <><Label htmlFor={`pin-${ticketType.id}`}>PIN CashPay</Label><Input id={`pin-${ticketType.id}`} type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value)} disabled={busy} /></>}
                <Button className="w-full onchat-btn-primary" onClick={purchase} disabled={busy || !quote || !quote.sufficientBalance || (quote.totalDebit > 0 && !pin)}>{busy ? 'Traitement…' : 'Autoriser et obtenir mes billets'}</Button>
            </div>}{error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
        </DialogContent></Dialog></>;
}
