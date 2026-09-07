
'use client';

import { useTranslation } from "react-i18next";
import { Home, Globe, Smartphone, CreditCard } from "lucide-react";
import Image from "next/image";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { cn } from "@/lib/utils";

export type TransferTypeOption = 'national' | 'mobile_money' | 'mastercard' | 'visa_direct' | 'western_union' | 'moneygram' | 'ria';


export function TransferOptions({ onSelect }: { onSelect: (type: TransferTypeOption) => void }) {
  const { t } = useTranslation();
  const { openAlert } = useAlertDialog();

  const handleOptionClick = (type: TransferTypeOption, enabled: boolean) => {
    if (enabled) {
      onSelect(type);
    } else {
      openAlert({
        title: t('featureComingSoonTitle'),
        description: t('featureComingSoonDescription'),
        variant: 'info'
      });
    }
  };

  const options = [
    { type: 'national' as const, labelKey: 'transferOptionNational', descriptionKey: 'transferOptionNationalDesc', icon: Home, enabled: true },
    { type: 'mobile_money' as const, labelKey: 'transferOptionMobileMoney', descriptionKey: 'transferOptionMobileMoneyDesc', icon: Smartphone, enabled: true },
    { type: 'visa_direct' as const, labelKey: 'transferOptionVisaDirect', descriptionKey: 'transferOptionVisaDirectDesc', icon: () => <Image src="/logos/visa.png" width={32} height={32} alt="Visa" />, enabled: false },
    { type: 'mastercard' as const, labelKey: 'transferOptionMastercard', descriptionKey: 'transferOptionMastercardDesc', icon: () => <Image src="/logos/mc.png" width={32} height={32} alt="MC" />, enabled: false },
    { type: 'western_union' as const, labelKey: 'transferOptionWU', descriptionKey: 'transferOptionWUDesc', icon: () => <Image src="/logos/westernunion.png" width={40} height={40} alt="WU" />, enabled: false },
    { type: 'moneygram' as const, labelKey: 'transferOptionMG', descriptionKey: 'transferOptionMGDesc', icon: () => <Image src="/logos/moneygram.png" width={40} height={40} alt="MG" />, enabled: false },
    { type: 'ria' as const, labelKey: 'transferOptionRIA', descriptionKey: 'transferOptionRIADesc', icon: () => <Image src="/logos/ria.png" width={40} height={40} alt="RIA" />, enabled: false },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sendMoneyChooseMethodTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {options.map(opt => (
          <div key={opt.type} className={cn("hover:bg-accent/50 cursor-pointer rounded-lg border p-4", !opt.enabled && "opacity-50 cursor-not-allowed")} onClick={() => handleOptionClick(opt.type, opt.enabled)}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted shrink-0">
                    <opt.icon className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">{t(opt.labelKey)}</h3>
                  <p className="text-sm text-muted-foreground">{t(opt.descriptionKey)}</p>
                </div>
              </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
