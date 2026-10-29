'use client';
import Link from 'next/link';
import { Video, Users, ArrowUpRight } from 'lucide-react';
import { useMeetingStatus } from '@/hooks/use-meeting-status';
export function MeetingInvitationCard({ code }: { code: string }) {
    const state = useMeetingStatus(code);
    const active = state.status === 'active'; const ended = state.status === 'ended';
    return <article className="my-3 w-full max-w-sm rounded-2xl border border-border bg-card text-card-foreground overflow-hidden shadow-lg">
        <div className="p-4 flex items-center gap-3" style={{ background: 'linear-gradient(120deg,#562EBF,#1D8AE4)' }}><Video className="text-white h-8 w-8" /><div className="text-white"><p className="font-bold">Invitation OnChat Meet</p><p className="text-xs text-white/80">{active ? '● En direct' : ended ? 'Réunion terminée' : 'Vérification du statut…'}</p></div></div>
        <div className="p-4 space-y-3"><p className="text-sm text-muted-foreground flex gap-2"><Users className="h-4 w-4" />{state.participants} participant(s)</p><p className="text-xs text-muted-foreground">Le tarif ou le billet requis sera présenté avant votre entrée.</p>{!ended && <Link href={`/feedback/meet/${encodeURIComponent(code)}`} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 flex justify-between items-center font-semibold text-sm">Voir les conditions et rejoindre<ArrowUpRight className="h-4 w-4" /></Link>}</div>
    </article>;
}
