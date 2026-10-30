'use client';
import { openOnChatSocket } from '@/lib/onchat-browser-socket';
import { useEffect, useState } from 'react';
import type { interDashboard as readDashboard } from '@/lib/inter-agent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react';

type Dashboard=Awaited<ReturnType<typeof readDashboard>>;
async function request(path:string,body?:object) {
 const response=await fetch(`/api/v1/inter-agent/${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await response.json();if(!response.ok||data.success!==true)throw new Error(data.error || 'Opération non confirmée.');return data;
}
async function getInterDashboard(page:number):Promise<Dashboard>{return request(`claims?page=${page}`);}
async function appointInterMember(body:object){return request('members',body);}
async function quoteClaim(id:number){return request(`claims/${id}/quote`);}
async function inspectClaim(id:number,pin:string){return request(`claims/${id}/inspect`,{pin});}
async function revealClaim(id:number,pin:string,quote:{maxNet:string;currency:string}){return request(`claims/${id}/reveal`,{pin,...quote});}
async function resolveClaim(body:{id:number;action:string;pin:string;receipt:string;reason:string;collected:boolean}){return request(`claims/${body.id}/resolve`,body);}
export function InterAgentOperations() {
 const [page,setPage]=useState(0);
 const [data,setData]=useState<Dashboard|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [quote,setQuote]=useState<any>(null);
 const [inspection,setInspection]=useState(false);
 const [selected,setSelected]=useState<number|null>(null),[detail,setDetail]=useState<any>(null),[pin,setPin]=useState(''),[receipt,setReceipt]=useState(''),[reason,setReason]=useState(''),[collected,setCollected]=useState(false);
 const [appointment,setAppointment]=useState(false),[wallet,setWallet]=useState(''),[agency,setAgency]=useState(''),[kind,setKind]=useState<'agent'|'supervisor'>('agent'),[supervisor,setSupervisor]=useState(''),[active,setActive]=useState(true);
 async function refresh(silent=false) {
  if(!silent)setLoading(true);
  try {setData(await getInterDashboard(page));setError('');} catch(e:any){setData(null);setDetail(null);setSelected(null);setError(e.message || 'Service indisponible.');} finally {if(!silent)setLoading(false);}
 }
 useEffect(()=>{
  void refresh();let active=true;let socket:WebSocket|null=null;let retry:ReturnType<typeof setTimeout>|null=null;
  const connect=async()=>{if(!active)return;try{socket=await openOnChatSocket(process.env.NEXT_PUBLIC_ONCHAT_WS_URL || `${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);
   if(!active){socket.close();return;}socket.onmessage=event=>{try{const data=JSON.parse(event.data);if(data.event==='inter.claim.updated')void refresh(true);}catch{}};
   socket.onclose=()=>{if(active)retry=setTimeout(connect,3000);};socket.onerror=()=>socket?.close();}catch{if(active)retry=setTimeout(connect,5000);}};void connect();
  const timer=setInterval(()=>void refresh(true),10000);
  return()=>{active=false;clearInterval(timer);if(retry)clearTimeout(retry);socket?.close();};
 },[page]);
 useEffect(()=>{let active=true;setQuote(null);if(selected!==null&&!inspection)quoteClaim(selected).then(value=>{if(active)setQuote(value);}).catch((e:any)=>{if(active)setError(e.message);});return()=>{active=false;};},[selected,inspection]);
 async function reveal() {
  if(!selected)return;setBusy(true);setError('');
  try {setDetail(inspection?await inspectClaim(selected,pin):await revealClaim(selected,pin,{maxNet:String(quote?.net || ''),currency:String(quote?.currency || '')}));setPin('');await refresh(true);}catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 async function resolve(action:'pay'|'reject') {
  if(!selected)return;setBusy(true);setError('');
  try {await resolveClaim({id:selected,action,pin,receipt,reason,collected});setDetail(null);setSelected(null);setPin('');await refresh();}catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 async function appoint() {
  setBusy(true);setError('');
  try {await appointInterMember({walletId:wallet,agency,kind,supervisorWalletId:supervisor,pin,active});setAppointment(false);setPin('');await refresh();}catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 const counts=data?.claims.reduce((out:Record<string,number>,row)=>{const key=row.processing_status || row.status;out[key]=(out[key]||0)+1;return out;},{}) || {};
 return <main className="max-w-7xl mx-auto space-y-6 p-4 md:p-8">
  <a href="/dashboard" className="text-sm text-muted-foreground underline">Retour à CashPay</a>
  <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">{data?.supervisor?'Supervision des agences inter':'Agence inter'}</h1><p className="text-sm text-muted-foreground">Western Union · MoneyGram · Ria — règlement depuis le wallet réel de l’agent</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>refresh()} disabled={loading}><RefreshCw className="h-4 w-4 mr-2"/>Actualiser</Button>{data?.canAppoint&&<Button onClick={()=>{setAppointment(true);setPin('');}}>Nommer / configurer un agent</Button>}</div></div>
  {error&&<p role="alert" className="p-4 border border-red-400 rounded-xl text-red-500">{error}</p>}
  {loading?<Loader2 className="animate-spin"/>:data&&<>
   <div className="grid sm:grid-cols-3 gap-4">{Object.entries(counts).map(([status,count])=><Card key={status}><CardHeader><CardTitle className="text-sm">{status}</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{String(count)}</CardContent></Card>)}</div>
   {!data.supervisor&&<Card><CardHeader><CardTitle>{data.membership?.agency_name} — fonds disponibles</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-6">{Object.entries(data.balances).map(([currency,amount])=><p key={currency}><strong>{String(amount)}</strong> {currency}</p>)}</CardContent></Card>}
   <Card><CardHeader><CardTitle>Totaux des dossiers traités, par devise</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>Devise</th><th>État</th><th>Dossiers</th><th>Montant net</th><th>Frais d’agence externes</th></tr></thead><tbody>{data.totals.map(t=><tr key={`${t.currency}-${t.status}`} className="border-t"><td className="py-3">{t.currency}</td><td>{t.status}</td><td>{t.count}</td><td>{t.amount}</td><td>{t.external_commission}</td></tr>)}</tbody></table></CardContent></Card>
   <p className="rounded-xl border p-4 text-sm flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0"/>Les données sensibles restent masquées jusqu’à la réservation. Frais d’agence : 3 %. Pour 100 USD, 97 USD sont réservés puis crédités au client. Aucun crédit supplémentaire de commission n’est créé. Un rejet libère la réservation seulement si les fonds externes n’ont pas été récupérés ; sinon le dossier reste en litige.</p>
   <Card><CardHeader><CardTitle>File des réclamations — réservations et anciennes demandes prioritaires</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>Dossier</th><th>Opérateur</th><th>Montant demandé</th><th>Réception</th><th>Traitement</th><th>Action</th></tr></thead><tbody>{data.claims.map(row=><tr key={row.id} className="border-t"><td className="py-3">#{row.id}</td><td>{row.provider}</td><td>{row.expected_amount} {row.expected_currency}</td><td>{row.receive_in_currency}</td><td>{row.processing_status || row.status}</td><td>{data.membership?.kind==='agent'&&(!row.agent_user_id || Number(row.agent_user_id)===Number(data.userId))&&<Button size="sm" variant="outline" onClick={()=>{setInspection(false);setSelected(row.id);setDetail(null);setPin('');setReceipt('');setReason('');setCollected(false);}}>Vérifier / traiter</Button>}{data.supervisor&&row.agent_user_id&&<Button size="sm" variant="ghost" onClick={()=>{setInspection(true);setSelected(row.id);setDetail(null);setPin('');}}>Suivre le dossier</Button>}</td></tr>)}</tbody></table>{data.claims.length===0&&<p className="py-6">Aucun dossier dans cette juridiction.</p>}<div className="flex justify-between items-center mt-4"><Button variant="outline" disabled={page===0||loading} onClick={()=>setPage(p=>Math.max(0,p-1))}>Précédent</Button><span>Page {page+1}</span><Button variant="outline" disabled={!data.hasMore||loading} onClick={()=>setPage(p=>p+1)}>Suivant</Button></div></CardContent></Card>
   {data.supervisor&&<Card><CardHeader><CardTitle>Agents et agences nommés</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>Agent</th><th>Wallet</th><th>Agence</th><th>Fonction</th><th>Statut</th></tr></thead><tbody>{data.members.map(m=><tr key={m.user_id} className="border-t"><td className="py-3">{m.full_name}</td><td>{m.id_wallet}</td><td>{m.agency_name}</td><td>{m.kind}</td><td>{m.active?'Actif':'Désactivé'}</td></tr>)}</tbody></table></CardContent></Card>}
   <Card><CardHeader><CardTitle>Journal des accès et règlements</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Date</th><th>Agent</th><th>Dossier</th><th>Action</th><th>Justification</th></tr></thead><tbody>{data.history.map(e=><tr key={e.id} className="border-t"><td className="py-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString('fr-FR')}</td><td>{e.detail?.actorName || e.actor_name}</td><td>{e.claim_id?`#${e.claim_id}`:'—'}</td><td>{e.action}</td><td>{e.detail?.reason || e.detail?.receipt || e.detail?.agency || ''}</td></tr>)}</tbody></table></CardContent></Card>
  </>}
  <Dialog open={selected!==null} onOpenChange={open=>{if(!open&&!busy){setSelected(null);setDetail(null);setPin('');}}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Réclamation #{selected}</DialogTitle></DialogHeader>
   {!detail?<><p>{inspection?'Consultation de supervision : accès nominatif journalisé, sans mouvement financier.':'Votre solde sera vérifié et le montant net sera réservé avant de dévoiler les informations du client. La consultation est nominative et journalisée.'}</p>{!inspection&&!quote&&!error&&<p className="flex gap-2 items-center text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Vérification du solde et du montant net…</p>}{!inspection&&quote&&<dl className="border rounded-xl p-4 text-sm grid grid-cols-2 gap-2"><dt>Net à réserver</dt><dd className="font-bold">{quote.net} {quote.currency}</dd><dt>Taux de conversion</dt><dd>{quote.rate}</dd><dt>Frais d’agence</dt><dd>{quote.feePercent} %</dd><dt>Solde disponible</dt><dd>{quote.balance} {quote.currency}</dd>{quote.existing&&<dd className="col-span-2">Dossier existant : aucun nouveau débit.</dd>}{!quote.sufficient&&<dd className="col-span-2 text-red-500">Veuillez approvisionner votre compte avant de consulter les données.</dd>}</dl>}<Label>PIN de l’agent</Label><Input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} maxLength={4}/><Button onClick={reveal} disabled={busy||pin.length!==4||(!inspection&&(!quote||!quote.sufficient))}>{busy?<Loader2 className="animate-spin mr-2 h-4 w-4"/>:null}{inspection?'Consulter pour contrôle':'Réserver les fonds et consulter'}</Button></>:<>
    <dl className="grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm"><dt>Client</dt><dd>{detail.claim.full_name}</dd><dt>Wallet</dt><dd>{detail.claim.id_wallet}</dd><dt>Montant déclaré</dt><dd>{detail.claim.expected_amount} {detail.claim.expected_currency}</dd><dt>Pays d’expédition</dt><dd>{detail.claim.sender_country}</dd><dt>Référence externe</dt><dd className="font-mono">{detail.claim.tracking_number}</dd><dt>Pièce d’identité</dt><dd>{detail.claim.id_type} · {detail.claim.id_number}</dd><dt>Montant net réservé</dt><dd className="font-bold">{detail.processing.net_amount} {detail.processing.currency}</dd><dt>Frais d’agence externes</dt><dd>{detail.processing.fee_amount} {detail.processing.currency}</dd><dt>État</dt><dd>{detail.processing.status}</dd></dl>
    {!detail.inspection&&['reserved','disputed'].includes(detail.processing.status)&&<><Label>Référence justificative d’encaissement externe</Label><Input value={receipt} onChange={e=>setReceipt(e.target.value)} maxLength={200}/><label className="flex gap-2 text-sm"><input type="checkbox" checked={collected} onChange={e=>setCollected(e.target.checked)}/>Je confirme que les fonds externes ont été récupérés.</label><Label>PIN pour autoriser le traitement</Label><Input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} maxLength={4}/><Button disabled={busy||pin.length!==4||!collected||receipt.trim().length<4} onClick={()=>resolve('pay')}>{busy&&<Loader2 className="animate-spin mr-2 h-4 w-4"/>}Créditer le client depuis les fonds réservés</Button><Label>Motif de rejet / litige</Label><Textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/><Button variant="destructive" disabled={busy||pin.length!==4||reason.trim().length<10} onClick={()=>resolve('reject')}>Rejeter / signaler un litige</Button></>}
   </>}{error&&<p role="alert" className="text-red-500">{error}</p>}
  </DialogContent></Dialog>
  <Dialog open={appointment} onOpenChange={open=>{if(!busy){setAppointment(open);setPin('');}}}><DialogContent><DialogHeader><DialogTitle>Nomination agent inter</DialogTitle></DialogHeader><Label>ID wallet existant</Label><Input value={wallet} onChange={e=>setWallet(e.target.value)}/><Label>Agence / partenaire</Label><Input value={agency} onChange={e=>setAgency(e.target.value)}/><Label>Fonction</Label><select value={kind} onChange={e=>setKind(e.target.value as 'agent'|'supervisor')} className="border rounded p-2 bg-background"><option value="agent">Agent inter — traitement</option><option value="supervisor">Super agent inter — supervision</option></select><Label>Wallet du superviseur inter (facultatif)</Label><Input value={supervisor} onChange={e=>setSupervisor(e.target.value)}/><label className="flex gap-2"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Nomination active</label><Label>PIN du Super Agent</Label><Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e=>setPin(e.target.value)}/><Button disabled={busy||pin.length!==4||!wallet||!agency} onClick={appoint}>{busy&&<Loader2 className="animate-spin mr-2 h-4 w-4"/>}Enregistrer la nomination</Button>{error&&<p role="alert" className="text-red-500">{error}</p>}</DialogContent></Dialog>
 </main>;
}
