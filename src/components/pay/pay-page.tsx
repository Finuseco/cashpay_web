
"use client";

import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { QrScannerDialog } from "@/components/shared/qr-scanner-dialog";
import type { User, Currency } from "@/lib/types";
import { PaymentConfirmationForm } from '@/components/pay/payment-confirmation-form';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { Button } from '@/components/ui/button';
import { ScanLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type ScannedData = {
    amount: number;
    currency: string;
    recipient: string;
} | null;

export default function PayPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [userCurrencies, setUserCurrencies] = useState<Currency[]>([]);
  const { openAlert } = useAlertDialog();

  const [scannedData, setScannedData] = useState<ScannedData>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  useEffect(() => {
    const fetchData = async () => {
        const fetchedUser = await getAuthenticatedUser();
        setUser(fetchedUser);
        if (fetchedUser) {
            const fetchedCurrencies = await getUserCurrencies(fetchedUser.id);
            setUserCurrencies(fetchedCurrencies);
        }
    };
    fetchData();
  }, []);

  const handleScanSuccess = (text: string) => {
    setIsScannerOpen(false);
    try {
      const data = JSON.parse(text);
      if (data.amount && data.currency && data.recipient) {
        setScannedData(data);
        return;
      }
    } catch (e) {
      if (text.startsWith('CP') && text.length === 12) {
        openAlert({ 
            variant: "warning", 
            title: t('qrCodeSimpleTitle'),
            description: t('qrCodeSimpleDescription') 
        });
        return;
      }
    }
    openAlert({ 
        variant: "error", 
        title: t('qrCodeInvalidTitle'), 
        description: t('qrCodeInvalidDescription') 
    });
  };

  const handlePaymentClose = () => {
    setScannedData(null);
  };

  return (
    <DashboardLayout>
      <QrScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScanSuccess={handleScanSuccess}
      />
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8 text-center">{t('payTitle')}</h1>
          
          {!scannedData ? (
             <Card>
                <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-4">
                    <ScanLine className="h-24 w-24 text-primary" />
                    <p className="text-muted-foreground">{t('payScannerDescription')}</p>
                    <Button size="lg" onClick={() => setIsScannerOpen(true)}>
                        {t('payScannerTitle')}
                    </Button>
                </CardContent>
             </Card>
          ) : (
            <PaymentConfirmationForm 
              user={user}
              paymentData={scannedData}
              userCurrencies={userCurrencies.filter(c => parseFloat(c.balance.replace(/,/g, '')) > 0)}
              onSuccess={handlePaymentClose}
            />
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
