'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRegionalDashboard } from '@/lib/actions/super-agent/dashboard.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Dashboard = Awaited<ReturnType<typeof getRegionalDashboard>>;
const queues = [ ['orders', 'Commandes', '/super-agent/orders'], ['cards', 'Commandes de cartes', '/super-agent/cards'],
    ['tv', 'Abonnements TV en attente', '/super-agent/tv-subscriptions'], ['claims', 'Réclamations en attente', '/super-agent/international-claims'],
    ['checks', 'Chèques émis', '/super-agent/support'] ];
const number = (value: unknown) => Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 8 });

export default function SuperAgentDashboard() {
    const [data, setData] = useState<Dashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    async function refresh() {
        setLoading(true); setError('');
        try { setData(await getRegionalDashboard()); }
        catch { setError('Tableau de bord indisponible. Vérifiez votre session puis réessayez.'); }
        finally { setLoading(false); }
    }
    useEffect(() => { void refresh(); }, []);
    const section = (key: string) => data?.sections[key];
    const users = section('users')?.rows[0];
    return <div className="space-y-6 pb-12">
        <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-bold">Tableau de bord régional</h1>
            <p className="text-zinc-400">{data?.country} {data?.province && ` / ${data.province}`}</p></div>
            <Button disabled={loading} onClick={refresh}>{loading ? 'Actualisation…' : 'Actualiser'}</Button></div>
        {error && <p role="alert" className="text-red-400">{error}</p>}
        {data && <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Utilisateurs', users?.total], ['Comptes actifs', users?.active], ['Comptes bloqués', users?.blocked], ['Agents et sous-super agents', users?.agents]].map(([label, value]) =>
                <Card key={label} className="bg-zinc-800 border-zinc-700"><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{value == null ? 'Indisponible' : number(value)}</CardContent></Card>)}</div>
            <Card className="bg-zinc-800 border-zinc-700"><CardHeader><CardTitle>Soldes disponibles des portefeuilles de la région</CardTitle></CardHeader><CardContent>
                {!section('balances')?.available ? 'Données indisponibles' : <div className="flex flex-wrap gap-6">{section('balances')?.rows.map(row => <div key={row.currency}><span className="text-zinc-400">{row.currency}</span><p className="text-2xl font-bold">{number(row.amount)}</p></div>)}</div>}
                <p className="text-xs text-zinc-400 mt-4">Avoirs des utilisateurs, distincts des recettes de l’organisation. Les devises ne sont pas additionnées.</p>
            </CardContent></Card>
            <Card className="bg-zinc-800 border-zinc-700"><CardHeader><CardTitle>Transactions terminées du mois — région de l’émetteur</CardTitle></CardHeader><CardContent>
                {!section('monthly')?.available ? 'Données indisponibles' : section('monthly')?.rows.length === 0 ? 'Aucune transaction terminée ce mois.' :
                    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Devise</th><th>Volume</th><th>Frais facturés</th><th>Nombre</th></tr></thead><tbody>{section('monthly')?.rows.map(row => <tr key={row.currency}><td>{row.currency}</td><td>{number(row.volume)}</td><td>{number(row.fees)}</td><td>{row.count}</td></tr>)}</tbody></table></div>}
                <p className="text-xs text-zinc-400 mt-4">Les frais facturés ne représentent pas un bénéfice net ni une commission acquise au gestionnaire.</p>
            </CardContent></Card>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{queues.map(([key, title, href]) => <Link href={href} key={key}><Card className="bg-zinc-800 border-zinc-700 h-full"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>{section(key)?.available ? <><strong className="text-2xl">{section(key)?.rows[0]?.total ?? section(key)?.rows[0]?.pending ?? 0}</strong>{section(key)?.rows[0]?.total != null && section(key)?.rows[0]?.pending != null && <p>{section(key)?.rows[0]?.pending} en attente</p>}</> : 'Données indisponibles'}</CardContent></Card></Link>)}</div>
            <Card className="bg-zinc-800 border-zinc-700"><CardHeader><CardTitle>Dernières opérations</CardTitle></CardHeader><CardContent>
                {!section('activity')?.available ? 'Données indisponibles' : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Référence</th><th>Utilisateur</th><th>Service</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{section('activity')?.rows.map((row, index) => <tr key={`${row.reference_code}-${index}`} className="border-t border-zinc-700"><td className="py-3">{row.reference_code}</td><td>{row.full_name}</td><td>{row.type_code}</td><td>{number(row.amount)} {row.currency}</td><td>{row.status}</td></tr>)}</tbody></table></div>}
            </CardContent></Card>
            <p className="text-xs text-zinc-400">Actualisé : {new Date(data.generatedAt).toLocaleString('fr-FR')}. Une source indisponible est signalée sans afficher un faux zéro.</p>
        </>}
    </div>;
}
