

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getDomainInfo, updateDnsRecords, purchaseSslCertificate, setDomainForwarding, sendRegistrantConsentEmail, manageDnssec } from '@/lib/actions/domain.actions';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Loader2, ArrowLeft, Globe, Server, KeyRound, Lock, Redo, Trash2, Plus, Forward, Mail, ShieldCheck, MailWarning, Shield, AppWindow } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Image from 'next/image';

type DnsRecord = { type: string; name: string; value: string; ttl: number };

export default function ManageDomainPage() {
    const params = useParams();
    const router = useRouter();
    const domainName = params.domainName as string;

    const [domainInfo, setDomainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
    const [forwardingDestination, setForwardingDestination] = useState('');
    const { openAlert } = useAlertDialog();

    useEffect(() => {
        const fetchInfo = async () => {
            setIsLoading(true);
            const result = await getDomainInfo(domainName);
            if (result.success) {
                setDomainInfo(result.data);
                setDnsRecords(result.data.dnsRecords);
            }
            setIsLoading(false);
        };
        fetchInfo();
    }, [domainName]);

    const handleDnsRecordChange = (index: number, field: keyof DnsRecord, value: string | number) => {
        const newRecords = [...dnsRecords];
        newRecords[index] = { ...newRecords[index], [field]: value };
        setDnsRecords(newRecords);
    };
    
    const addDnsRecord = () => {
        setDnsRecords([...dnsRecords, { type: 'A', name: '', value: '', ttl: 3600 }]);
    };
    
    const removeDnsRecord = (index: number) => {
        setDnsRecords(dnsRecords.filter((_, i) => i !== index));
    };
    
    const handleCpanelFeature = () => {
        openAlert({ title: 'Intégration cPanel', description: "Cette fonctionnalité nécessiterait l'API cPanel pour être implémentée.", variant: 'info' });
    }

    const handleSaveDns = async () => {
        const result = await updateDnsRecords(domainName, dnsRecords);
        if (result.success) {
            openAlert({ title: 'Succès', description: 'Les enregistrements DNS ont été mis à jour.', variant: 'success' });
        } else {
            openAlert({ title: 'Erreur', description: 'Impossible de mettre à jour les enregistrements DNS.', variant: 'error' });
        }
    };
    
    const handlePurchaseSsl = async (type: string) => {
        const result = await purchaseSslCertificate(domainName, type);
        if(result.success) {
            openAlert({ title: 'Achat Réussi', description: `Le certificat SSL ${type} a été commandé.`, variant: 'success' });
        } else {
            openAlert({ title: 'Erreur', description: `Impossible de commander le certificat SSL.`, variant: 'error' });
        }
    };

    const handleSetForwarding = async () => {
        const result = await setDomainForwarding(domainName, forwardingDestination);
        if(result.success) {
            openAlert({ title: 'Succès', description: `La redirection vers ${forwardingDestination} a été configurée.`, variant: 'success' });
        } else {
            openAlert({ title: 'Erreur', description: `Impossible de configurer la redirection.`, variant: 'error' });
        }
    };
    
    const handleSendConsent = async () => {
        const result = await sendRegistrantConsentEmail(domainName);
        if(result.success) {
            openAlert({ title: 'Email Envoyé', description: `L'email de consentement pour le transfert a été envoyé.`, variant: 'success' });
        } else {
            openAlert({ title: 'Erreur', description: `Impossible d'envoyer l'email.`, variant: 'error' });
        }
    };
    
    const handleManageDnssec = async () => {
        // Placeholder for a real implementation that would show a dialog with DNSSEC settings
        const result = await manageDnssec(domainName, { enabled: true });
        if(result.success) {
            openAlert({ title: 'DNSSEC', description: 'La gestion de DNSSEC sera bientôt disponible ici.', variant: 'info' });
        } else {
            openAlert({ title: 'Erreur', description: 'Impossible de gérer DNSSEC.', variant: 'error' });
        }
    };

    if (isLoading) {
        return <DashboardLayout><div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div></DashboardLayout>;
    }

    if (!domainInfo) {
        return <DashboardLayout><div>Impossible de charger les informations du domaine.</div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="flex items-center gap-4">
                         <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
                         <div>
                            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Globe/> {domainInfo.domainName}</h1>
                            <p className="text-muted-foreground">Gestion détaillée du domaine et de l'hébergement</p>
                        </div>
                    </div>

                    {/* cPanel Management Card */}
                     <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><AppWindow /> Gestion de l'Hébergement</CardTitle>
                                    <CardDescription>Gérez les aspects clés de votre hébergement web.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Powered by</span>
                                    <Image src="https://www.cpanel.net/wp-content/themes/cpanel/images/cpanel-logo-icon-v-2.svg" alt="cPanel logo" width={20} height={20} data-ai-hint="cpanel logo"/>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                           <Card className="p-4 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
                                <Mail className="h-8 w-8 text-primary mb-2"/>
                                <p className="font-semibold">Adresses E-mail</p>
                                <p className="text-xs text-muted-foreground mb-3">Créez des e-mails professionnels.</p>
                                <Button size="sm" variant="outline" onClick={handleCpanelFeature}>Gérer</Button>
                           </Card>
                            <Card className="p-4 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
                                <Globe className="h-8 w-8 text-primary mb-2"/>
                                <p className="font-semibold">Sous-domaines</p>
                                <p className="text-xs text-muted-foreground mb-3">Organisez votre site en sections.</p>
                                <Button size="sm" variant="outline" onClick={handleCpanelFeature}>Gérer</Button>
                           </Card>
                           <Card className="p-4 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
                                <Server className="h-8 w-8 text-primary mb-2"/>
                                <p className="font-semibold">Installer WordPress</p>
                                <p className="text-xs text-muted-foreground mb-3">Démarrez votre blog ou site en un clic.</p>
                                <Button size="sm" variant="outline" onClick={handleCpanelFeature}>Installer</Button>
                           </Card>
                        </CardContent>
                    </Card>

                    
                    {/* DNS Management Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Server/> Gestion DNS</CardTitle>
                            <CardDescription>Pointez votre domaine vers un serveur ou configurez des services externes.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Type</TableHead>
                                       <TableHead>Nom</TableHead>
                                       <TableHead>Valeur</TableHead>
                                       <TableHead>TTL</TableHead>
                                       <TableHead></TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {dnsRecords.map((record, index) => (
                                       <TableRow key={index}>
                                           <TableCell><Select value={record.type} onValueChange={(val) => handleDnsRecordChange(index, 'type', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="CNAME">CNAME</SelectItem><SelectItem value="MX">MX</SelectItem><SelectItem value="TXT">TXT</SelectItem></SelectContent></Select></TableCell>
                                           <TableCell><Input value={record.name} onChange={(e) => handleDnsRecordChange(index, 'name', e.target.value)} placeholder="@, www, mail..."/></TableCell>
                                           <TableCell><Input value={record.value} onChange={(e) => handleDnsRecordChange(index, 'value', e.target.value)} placeholder="Adresse IP, nom de domaine..."/></TableCell>
                                           <TableCell><Input type="number" value={record.ttl} onChange={(e) => handleDnsRecordChange(index, 'ttl', Number(e.target.value))}/></TableCell>
                                           <TableCell><Button variant="ghost" size="icon" onClick={() => removeDnsRecord(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                           <Button variant="outline" size="sm" onClick={addDnsRecord} className="mt-4"><Plus className="mr-2 h-4 w-4"/> Ajouter un enregistrement</Button>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSaveDns}>Sauvegarder les changements DNS</Button>
                        </CardFooter>
                    </Card>

                     {/* Forwarding Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Forward/> Redirection</CardTitle>
                            <CardDescription>Redirigez votre domaine ou vos e-mails vers une autre destination.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           <div className="space-y-2">
                                <Label htmlFor="forwarding-dest">Redirection de domaine</Label>
                                <div className="flex gap-2">
                                    <Input id="forwarding-dest" placeholder="https://votredestination.com" value={forwardingDestination} onChange={(e) => setForwardingDestination(e.target.value)} />
                                    <Button onClick={handleSetForwarding}>Appliquer</Button>
                                </div>
                            </div>
                             <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground border rounded-lg">
                                <Mail className="h-5 w-5"/>
                                <span>La redirection d'e-mails sera bientôt disponible.</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Security Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Lock/> Sécurité du Domaine</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label>Verrouillage du bureau d'enregistrement</Label>
                                    <p className="text-xs text-muted-foreground">Empêche les transferts non autorisés de votre domaine.</p>
                                </div>
                                <Switch checked={domainInfo.registrarLock} />
                            </div>
                             <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label>Clé de transfert (Code EPP)</Label>
                                    <p className="text-xs text-muted-foreground">Nécessaire pour transférer votre domaine vers un autre bureau d'enregistrement.</p>
                                </div>
                                <Button variant="secondary"><KeyRound className="mr-2 h-4 w-4"/> Révéler le code</Button>
                            </div>
                              <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label>Email de consentement</Label>
                                    <p className="text-xs text-muted-foreground">Envoyez un e-mail pour approuver les modifications du registrant.</p>
                                </div>
                                <Button variant="secondary" onClick={handleSendConsent}><MailWarning className="mr-2 h-4 w-4"/> Envoyer</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* DNSSEC Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Shield/> Sécurité du Domaine (DNSSEC)</CardTitle>
                            <CardDescription>Protégez votre domaine contre l'usurpation d'identité avec DNSSEC.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label>Gestion DNSSEC</Label>
                                    <p className="text-xs text-muted-foreground">Ajoutez et gérez les enregistrements DS pour votre domaine.</p>
                                </div>
                                <Button variant="secondary" onClick={handleManageDnssec}>Gérer DNSSEC</Button>
                            </div>
                        </CardContent>
                    </Card>


                    {/* SSL Card */}
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck /> Certificats SSL</CardTitle><CardDescription>Sécurisez votre site avec le cryptage HTTPS.</CardDescription></CardHeader>
                        <CardContent>
                            <div className="p-4 bg-muted text-center rounded-lg">
                                <p className="text-muted-foreground">Aucun certificat SSL actif pour ce domaine.</p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col sm:flex-row gap-2">
                            <Button className="w-full" onClick={() => handlePurchaseSsl('Standard')}>Acheter SSL Standard (10$/an)</Button>
                            <Button className="w-full" variant="secondary" onClick={() => handlePurchaseSsl('Wildcard')}>Acheter SSL Wildcard (75$/an)</Button>
                        </CardFooter>
                    </Card>


                     {/* Renewal Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Redo/> Renouvellement</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label>Expire le</Label>
                                    <p className="font-semibold">{new Date(domainInfo.expires).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <Button>Renouveler Maintenant</Button>
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label>Renouvellement automatique</Label>
                                    <p className="text-xs text-muted-foreground">Votre domaine sera renouvelé automatiquement avant son expiration.</p>
                                </div>
                                <Switch checked={domainInfo.autoRenew} />
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </main>
        </DashboardLayout>
    );
}
