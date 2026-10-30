'use client';
import {useState} from 'react';
import type {User,Country} from '@/lib/types';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {Loader2,ShieldCheck} from 'lucide-react';

/** Client declarations are never presented as a successful provider lookup. */
export function InternationalTransferForm({user,countries}:{user:User|null;countries:Country[]}) {
 const [provider,setProvider]=useState('western_union'),[tracking,setTracking]=useState(''),[amount,setAmount]=useState(''),[currency,setCurrency]=useState('USD'),[receive,setReceive]=useState('USD'),[country,setCountry]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmation,setConfirmation]=useState('');
 async function submit(event:React.FormEvent) {
  event.preventDefault();if(!user||busy||!consent)return;setBusy(true);setError('');setConfirmation('');
  try {
   const response=await fetch('/api/v1/international-transfer/claims',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,trackingNumber:tracking.trim(),expectedAmount:Number(amount),expectedCurrency:currency,receiveInCurrency:receive,senderCountry:country,feeConsent:true})});
   const result=await response.json();if(!response.ok||result.success!==true)throw new Error(result.error || 'La demande n’a pas été confirmée.');
   setConfirmation(`Réclamation #${result.claim.id} enregistrée. Un agent inter habilité vérifiera les informations et pourra effectuer le règlement depuis son wallet. Aucun montant n’a encore été crédité.`);
   setTracking('');setAmount('');setConsent(false);
  }catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 const selectClass='w-full rounded-md border bg-background p-3';
 return <Card><CardHeader><CardTitle>Recevoir un transfert international</CardTitle></CardHeader><CardContent>
  <p className="text-sm text-muted-foreground mb-6">Soumettez votre demande Western Union, MoneyGram ou Ria. Les informations sont déclaratives jusqu’à la vérification par une agence habilitée.</p>
  {!user?<p>Connectez-vous pour soumettre une réclamation.</p>:<form onSubmit={submit} className="space-y-5"><fieldset disabled={busy} className="space-y-5">
   <div className="space-y-2"><Label htmlFor="claim-provider">Opérateur</Label><select id="claim-provider" className={selectClass} value={provider} onChange={e=>setProvider(e.target.value)}><option value="western_union">Western Union</option><option value="moneygram">MoneyGram</option><option value="ria">Ria</option></select></div>
   <div className="space-y-2"><Label htmlFor="claim-reference">Référence MTCN / PIN / suivi</Label><Input id="claim-reference" required autoComplete="off" minLength={6} maxLength={80} value={tracking} onChange={e=>setTracking(e.target.value)} className="font-mono"/></div>
   <div className="grid sm:grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="claim-amount">Montant envoyé déclaré</Label><Input id="claim-amount" required type="number" min="0.01" max="100000000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="claim-currency">Devise du transfert</Label><select id="claim-currency" className={selectClass} value={currency} onChange={e=>setCurrency(e.target.value)}>{['USD','EUR','CDF'].map(c=><option key={c}>{c}</option>)}</select></div></div>
   <div className="space-y-2"><Label htmlFor="claim-country">Pays d’expédition</Label><select id="claim-country" required className={selectClass} value={country} onChange={e=>setCountry(e.target.value)}><option value="">Choisir un pays</option>{countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
   <div className="space-y-2"><Label htmlFor="claim-receive">Devise du crédit CashPay</Label><select id="claim-receive" className={selectClass} value={receive} onChange={e=>setReceive(e.target.value)}>{['USD','EUR','CDF'].map(c=><option key={c}>{c}</option>)}</select></div>
   <div className="rounded-xl border p-4 text-sm space-y-3"><p className="flex gap-2"><ShieldCheck className="h-5 w-5 shrink-0"/>Frais d’agence : 3 % du montant récupéré. Pour 100 USD sans conversion, vous recevez 97 USD. Une conversion utilise le taux configuré pour votre pays.</p><label className="flex gap-3 items-start"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1"/><span>Je confirme les informations et accepte les frais affichés ainsi que leur vérification par un agent inter habilité.</span></label></div>
   <Button type="submit" disabled={!consent||busy} className="w-full">{busy&&<Loader2 className="h-4 w-4 animate-spin mr-2"/>}Soumettre ma réclamation</Button>
  </fieldset></form>}
  {error&&<p role="alert" className="text-red-500 mt-4">{error}</p>}{confirmation&&<p role="status" className="p-4 mt-4 border rounded-xl">{confirmation}</p>}
 </CardContent></Card>;
}
