
'use client';

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFeeStructuresForCountry, type FeeStructure } from '@/lib/actions/fees.actions';
import { Skeleton } from "../ui/skeleton";
import { countries } from "@/lib/countries";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { countryToCode } from "@/lib/utils";
import type { User } from '@/lib/types';

interface FeeTier {
    fee: string;
    max: number;
    min: number;
}

const feeTypeTitles: Record<string, { title: string, description: string }> = {
    'WD': { title: "Frais de Retrait Guichet", description: "Frais pour les retraits en espèces dans nos agences." },
    'TR': { title: "Frais de Transfert", description: "Frais pour les transferts entre comptes CashPay." },
    'WD_AIRTEL_MONEY': { title: "Frais de Retrait Airtel Money", description: "Frais pour le retrait de fonds vers un compte Airtel Money." },
    'WD_MPESA': { title: "Frais de Retrait M-Pesa", description: "Frais pour le retrait de fonds vers un compte M-Pesa." },
    'WD_ORANGE_MONEY': { title: "Frais de Retrait Orange Money", description: "Frais pour le retrait de fonds vers un compte Orange Money." },
    'WD_AFRIMONEY': { title: "Frais de Retrait Afrimoney", description: "Frais pour le retrait de fonds vers un compte Afrimoney."},
    'WD_MTN_MOMO': { title: "Frais de Retrait MTN MoMo", description: "Frais pour le retrait de fonds vers un compte MTN Mobile Money."},
    'DP_GENERAL_FEES': { title: "Frais de Dépôt", description: "Frais généraux appliqués sur certains types de dépôts."},
    'WD_VIREMENT_BANKS_FEES': { title: "Frais de Virement Bancaire", description: "Frais pour les transferts vers un compte bancaire externe."},
    'WD_CRYPTO_MONEY': { title: "Frais de Retrait Crypto", description: "Frais pour la conversion et l'envoi de cryptomonnaies."},
    'WD_PAYPAL': { title: "Frais de Retrait PayPal", description: "Frais pour le retrait de fonds vers un compte PayPal."},
    'PRODUCT_SALE_VAT': { title: "TVA sur Vente de Produits", description: "Taxe sur la valeur ajoutée appliquée aux ventes de produits."},
    'CD_CREATION_V': { title: "Frais de Création de Carte Virtuelle", description: "Frais uniques pour l'émission d'une carte virtuelle."},
    'CD_CREATION_P': { title: "Frais de Création de Carte Physique", description: "Frais uniques pour la production d'une carte physique."},
    'MONPAYS_PAGE': { title: "Frais d'Enregistrement MonPays", description: "Frais uniques pour l'enregistrement et la vérification d'une page entreprise."},
    'SMS_PACKAGE': { title: "Achat de Packs SMS", description: "Tarifs pour l'achat de crédits SMS pour le marketing."},
    'B2B_CARD_ISSUE': { title: "Frais d'Émission de Carte B2B", description: "Frais pour l'émission d'une carte pour un partenaire B2B."},
    'WD_ATM_USD': { title: "Frais de Retrait GAB (USD)", description: "Frais pour les retraits aux guichets automatiques en USD." },
    'WD_ATM_EUR': { title: "Frais de Retrait GAB (EUR)", description: "Frais pour les retraits aux guichets automatiques en EUR." },
    'WD_ATM_CDF': { title: "Frais de Retrait GAB (CDF)", description: "Frais pour les retraits aux guichets automatiques en CDF." },
};

const FeeTable = ({ data, currencySymbol }: { data: FeeTier[], currencySymbol: string }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Montant Min</TableHead>
        <TableHead>Montant Max</TableHead>
        <TableHead className="text-right">Frais</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((tier, index) => (
        <TableRow key={index}>
          <TableCell>{tier.min > 0 ? `${tier.min.toLocaleString('fr-FR')} ${currencySymbol}` : '0'}</TableCell>
          <TableCell>{tier.max === 0 ? 'et plus' : `${tier.max.toLocaleString('fr-FR')} ${currencySymbol}`}</TableCell>
          <TableCell className="text-right font-semibold">{tier.fee}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const LoadingSkeleton = () => (
    <Card>
        <CardHeader>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3 mt-2" />
        </CardHeader>
        <CardContent>
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-48 w-full" />
        </CardContent>
    </Card>
)

const FeeCard = ({ feeData, title, description }: { feeData: FeeStructure[], title: string, description: string }) => {
    if (!feeData || feeData.length === 0) return null;
    
    const availableCurrencies = Array.from(new Set(feeData.map(f => f.currency)));
    const defaultTab = availableCurrencies.includes('USD') ? 'USD' : availableCurrencies[0];

    const getSymbol = (currencyCode: string) => {
      const country = countries.find(c => c.currency_code === currencyCode);
      return country?.currency_symbol || currencyCode;
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className={`grid w-full grid-cols-${availableCurrencies.length}`}>
              {availableCurrencies.map(currency => (
                <TabsTrigger key={currency} value={currency}>{currency}</TabsTrigger>
              ))}
            </TabsList>
            {availableCurrencies.map(currency => {
              const feeStructure = feeData.find(f => f.currency === currency);
              const symbol = getSymbol(currency);
              return (
                <TabsContent key={currency} value={currency} className="mt-4">
                  <FeeTable data={feeStructure?.fee_tiers || []} currencySymbol={symbol} />
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    );
  };

export function FeeScheduleClient() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [fees, setFees] = useState<Record<string, FeeStructure[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchFees = useCallback(async () => {
    const currentUser = await getAuthenticatedUser();
    setUser(currentUser);
    if (currentUser?.country) {
      const countryCode = countryToCode(currentUser.country);
      
      setIsLoading(true);
      const [localFees, globalFees] = await Promise.all([
          getFeeStructuresForCountry(countryCode || 'CD'), // Fallback to CD
          getFeeStructuresForCountry('GBL')
      ]);

      // Merge local and global fees, local takes precedence
      const mergedFees = { ...globalFees, ...localFees };

      setFees(mergedFees);
      setIsLoading(false);
    } else {
       setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  const feeSections = Object.entries(fees)
    .filter(([typeCode, feeData]) => feeData && feeData.length > 0)
    .map(([typeCode, feeData]) => {
        const titleInfo = feeTypeTitles[typeCode] || { title: typeCode, description: `Frais pour les opérations de type ${typeCode}.` };
        return (
            <FeeCard
                key={typeCode}
                feeData={feeData}
                title={titleInfo.title}
                description={titleInfo.description}
            />
        );
    });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">{t('feesTitle', 'Grille Tarifaire')}</h1>
        <p className="text-muted-foreground">{t('feesDescription', 'Retrouvez ci-dessous l\'ensemble de nos frais de retrait et de transfert.')}</p>
      </div>
      
      {isLoading ? (
        <div className="grid md:grid-cols-1 gap-6">
          <LoadingSkeleton/>
          <LoadingSkeleton/>
        </div>
      ) : feeSections.length > 0 ? (
        <div className="grid md:grid-cols-1 gap-6">{feeSections}</div>
      ) : (
        <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
                <p>Les grilles tarifaires pour votre région ne sont pas encore disponibles.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
