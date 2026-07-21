
'use client';

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Gift, Users, CheckCircle2, Loader2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { User, Referral, Currency } from "@/lib/types";
import { claimReferralReward } from "@/lib/actions/referral.actions";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function ReferralClient({ 
    user, 
    referrals: initialReferrals, 
    currencies, 
    pointConversionRate 
}: { 
    user: User | null, 
    referrals: Referral[], 
    currencies: Currency[], 
    pointConversionRate: number | null 
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals);
  const [isClaiming, setIsClaiming] = useState<number | null>(null);
  
  const referralLink = user ? `${window.location.origin}/referral/${user.id_wallet}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    openAlert({
      variant: "info",
      title: t('toastCopied'),
      description: t('referralToastLinkCopied'),
    });
  };
  
  const handleClaim = async (referral: Referral) => {
      setIsClaiming(referral.id);
      const result = await claimReferralReward(referral.id);
      setIsClaiming(null);

      if (result.success) {
          setReferrals(prev => prev.map(r => r.id === referral.id ? { ...r, isClaimed: true } : r));
          openAlert({
              variant: "success",
              title: t('referralRewardClaimedTitle'),
              description: t('referralRewardClaimedDesc', { name: referral.fullName }),
              onClose: () => router.refresh()
          });
      } else {
          openAlert({ variant: "error", title: t('error'), description: result.error });
      }
  };

  const pendingCount = referrals.filter(r => r.status === 'Pending Deposit').length;
  const claimableCount = referrals.filter(r => r.status === 'Active' && !r.isClaimed).length;
  const totalClaimedCount = referrals.filter(r => r.isClaimed).length;

  const localCurrency = useMemo(() => {
    return currencies.find(c => c.code !== 'USD' && c.code !== 'EUR') || { code: 'CDF', symbol: 'FC' };
  }, [currencies]);
  
  const claimableValue = (claimableCount * (pointConversionRate || 100));
  const totalEarnedValue = (totalClaimedCount * (pointConversionRate || 100));

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">{t('referralTitle')}</h1>
            <p className="text-muted-foreground">{t('referralDescription')}</p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">{t('referralLinkCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
              <Input value={referralLink} readOnly className="bg-background font-mono text-xs" />
              <Button onClick={copyLink} variant="gradient" className="w-full sm:w-auto shrink-0 font-bold">
                  <Copy className="mr-2 h-4 w-4" /> {t('referralCopyButton')}
              </Button>
          </CardContent>
        </Card>
        
        <div className="grid md:grid-cols-3 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground uppercase">{t('referralPendingCountLabel')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-bold text-zinc-400">{pendingCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{t('referralPendingCountSub')}</p>
                </CardContent>
            </Card>
            <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-green-600 font-bold uppercase">{t('referralClaimableGainsLabel')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-bold text-green-600">{claimableValue.toLocaleString()} <span className="text-sm">{localCurrency.symbol}</span></p>
                    <p className="text-[10px] text-green-600/70 mt-1">{t('referralClaimableGainsSub', { count: claimableCount })}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground uppercase">{t('referralTotalEarnedLabel')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-bold">{totalEarnedValue.toLocaleString()} <span className="text-sm">{localCurrency.symbol}</span></p>
                    <p className="text-[10px] text-muted-foreground mt-1">{t('referralTotalEarnedSub')}</p>
                </CardContent>
            </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>{t('referralListTitle')}</span>
            </CardTitle>
            <CardDescription>{t('referralListDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>{t('referralTableHeaderUser')}</TableHead>
                          <TableHead>{t('referralTableHeaderDate')}</TableHead>
                          <TableHead>{t('referralTableHeaderStatus')}</TableHead>
                          <TableHead className="text-right">{t('referralTableHeaderAction')}</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {referrals.length > 0 ? referrals.map(referral => (
                            <TableRow key={referral.id}>
                              <TableCell className="font-medium">{referral.fullName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{referral.date}</TableCell>
                              <TableCell>
                                  <Badge variant="outline" className={cn(
                                      "text-[10px]",
                                      referral.status === 'Active' ? 'border-green-500 text-green-600' : 'text-zinc-400'
                                  )}>
                                      {referral.status === 'Active' ? t('referralStatusActive') : t('referralStatusInactive')}
                                  </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                  {referral.isClaimed ? (
                                      <div className="flex items-center justify-end text-green-600 gap-1 text-xs font-bold">
                                          <CheckCircle2 className="h-4 w-4" /> {t('referralClaimed')}
                                      </div>
                                  ) : referral.status === 'Active' ? (
                                      <Button 
                                        size="sm" 
                                        variant="gradient" 
                                        className="h-8 text-[10px] font-bold"
                                        disabled={isClaiming === referral.id}
                                        onClick={() => handleClaim(referral)}
                                      >
                                          {isClaiming === referral.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3 mr-1" />}
                                          {t('referralClaimButton')}
                                      </Button>
                                  ) : (
                                      <span className="text-[10px] text-muted-foreground italic">{t('referralPendingCountSub')}</span>
                                  )}
                              </TableCell>
                          </TableRow>
                      )) : (
                          <TableRow>
                              <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">{t('referralNoReferrals')}</TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
