

'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Server, Smartphone, KeyRound, Store } from 'lucide-react';
import type { Seller } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function SellerDetailsContent({ seller }: { seller: Seller | null }) {
  const router = useRouter();
  const { t } = useTranslation();

  if (!seller) {
    return <div>{t('sellerNotFound', 'Vendeur non trouvé.')}</div>;
  }
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('sellerDetailsTitle')}</h1>
          <p className="text-muted-foreground">{t('sellerDetailsDescription')}</p>
        </div>
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
           <Avatar className="h-16 w-16">
            <AvatarImage src={seller.profile_photo || undefined} alt={seller.fullName} />
            <AvatarFallback>{seller.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{seller.fullName}</CardTitle>
            <CardDescription className="font-mono">{seller.id_wallet}</CardDescription>
            <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="flex items-center gap-1.5"><KeyRound className="h-3 w-3"/> {t(`role${seller.role}`)}</Badge>
                <Badge variant="outline" className="flex items-center gap-1.5"><Store className="h-3 w-3"/> {seller.boutiqueName}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>{t('sessionHistoryTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sessionStatus')}</TableHead>
                <TableHead>{t('sessionLoginTime')}</TableHead>
                <TableHead>{t('sessionLogoutTime')}</TableHead>
                <TableHead>{t('sessionIpAddress')}</TableHead>
                <TableHead>{t('sessionDevice')}</TableHead>
                <TableHead>{t('sessionBrowser')}</TableHead>
                <TableHead>{t('sessionOS')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seller.sessions && seller.sessions.length > 0 ? (
                [...seller.sessions].reverse().map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      {session.logoutTime ? (
                        <Badge variant="secondary">{t('sessionStatusLoggedOut')}</Badge>
                      ) : (
                        <Badge className="bg-green-500 hover:bg-green-600">{t('sessionStatusActive')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(session.loginTime)}</TableCell>
                    <TableCell>{formatDate(session.logoutTime)}</TableCell>
                    <TableCell className="font-mono">{session.ipAddress}</TableCell>
                    <TableCell className="flex items-center gap-2">
                        {session.device === 'Mobile' ? <Smartphone className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                        {session.device}
                    </TableCell>
                    <TableCell>{session.browser}</TableCell>
                    <TableCell>{session.os}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t('noSessionsFound')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
