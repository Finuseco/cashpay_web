
"use client";

import { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User, Currency } from '@/lib/types';
import { useTranslation } from "react-i18next";
import { Copy, Printer, Share2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import jsPDF from 'jspdf';
import { Logo } from '@/components/logo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { getReceiptLogoBase64 } from '@/lib/actions/transaction.actions';

export function ReceiveQrCode({ user }: { user: User | null }) {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const printableRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<HTMLDivElement>(null);
    const [isClient, setIsClient] = useState(false);
    
    const [amount, setAmount] = useState<number | ''>('');
    const [currency, setCurrency] = useState('USD');
    const [qrValue, setQrValue] = useState<string>(user?.id_wallet || '');
    const [userCurrencies, setUserCurrencies] = useState<Currency[]>([]);
    const [logoBase64, setLogoBase64] = useState<string | null>(null);


    useEffect(() => {
        setIsClient(true);
        if (user) {
            getUserCurrencies(user.id).then(setUserCurrencies);
            getReceiptLogoBase64().then(setLogoBase64);
        }
    }, [user]);

    useEffect(() => {
        if (user && amount && currency) {
            try {
                setQrValue(JSON.stringify({
                    recipient: user.id_wallet,
                    amount: Number(amount),
                    currency: currency,
                }));
            } catch (error) {
                console.error("Error creating QR code value:", error);
                setQrValue(user.id_wallet || '');
            }
        } else {
            setQrValue(user?.id_wallet || '');
        }
    }, [amount, currency, user]);


    if (!user) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{isClient ? t('receiveQrCodeTitle') : 'Your QR Code'}</CardTitle>
                    <CardDescription>{isClient ? t('receiveQrCodeDescription') : 'Generate a QR code with a specific amount to receive money.'}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-8">
                    <p className="text-muted-foreground">User not found.</p>
                </CardContent>
            </Card>
        );
    }
    
    const pdfDescription = t('receivePdfDescription');

    const copyToClipboard = () => {
        if (user?.id_wallet) {
          navigator.clipboard.writeText(user.id_wallet);
          openAlert({
            variant: 'info',
            title: isClient ? t('toastCopied') : 'Copied!',
            description: isClient ? t('toastCopiedDescription') : 'Wallet ID copied to clipboard.',
          });
        }
      };

    const handlePrint = () => {
        window.print();
    };

    const handleSharePdf = async () => {
        const element = pdfRef.current;
        if (!element) return;
        
        const html2canvas = (await import('html2canvas')).default;
    
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight
        });
    
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });
    
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
    
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('cashpay-qrcode.pdf');
    };

    return (
        <div>
            {/* Hidden element for PDF generation, positioned off-screen */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={pdfRef} className="p-10 bg-white text-black flex items-center justify-center" style={{ width: '210mm', height: '297mm', fontFamily: 'Arial, sans-serif' }}>
                    <div className="w-full max-w-lg border border-gray-300 rounded-xl shadow-lg p-10 flex flex-col items-center">
                        {logoBase64 && <img src={logoBase64} alt="CashPay Logo" className="w-64 mb-8" />}
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-black">Paiement via CashPay</h2>
                            <p className="text-md text-gray-600 mt-2">{pdfDescription}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border-2 border-gray-200">
                            <QRCodeSVG
                                value={qrValue}
                                size={256}
                                bgColor={"#FFFFFF"}
                                fgColor={"#000000"}
                                level={"Q"}
                                includeMargin={false}
                            />
                        </div>
                        <div className="text-center mt-6">
                            <Avatar className="h-20 w-20 mx-auto mb-3 border-4" style={{borderColor: '#FF6600'}}>
                                <AvatarImage src={user.profile_photo || "/avatars/default.png"} alt={user.full_name} />
                                <AvatarFallback className="text-black bg-gray-200">{user.first_name?.[0]}{user.last_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <p className="font-bold text-xl text-black">{user.full_name}</p>
                            <p className="font-mono text-base text-gray-600 mt-1">{user.id_wallet}</p>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                {`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-qr-code, #printable-qr-code * {
                        visibility: visible;
                    }
                    #printable-qr-code {
                        position: absolute;
                        left: 50%;
                        top: 2rem;
                        transform: translateX(-50%);
                    }
                }
                `}
            </style>
            <div id="printable-qr-code" ref={printableRef}>
                <Card className="w-full">
                    <CardHeader className="text-center p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">{isClient ? t('receiveQrCodeTitle') : 'Your QR Code'}</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">{isClient ? t('receiveQrCodeDescription') : 'Generate a QR code with a specific amount to receive money.'}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4 px-6 pb-6">
                         <div className="w-full space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="amount">{isClient ? t('receiveAmountLabel') : 'Amount (Optional)'}</Label>
                                    <Input 
                                        id="amount" 
                                        type="number" 
                                        placeholder="10.00" 
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="currency">{isClient ? t('currencyLabel') : 'Currency'}</Label>
                                    <Select value={currency} onValueChange={setCurrency}>
                                        <SelectTrigger id="currency">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {userCurrencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border">
                            <QRCodeSVG
                                value={qrValue}
                                size={192}
                                bgColor={"#FFFFFF"}
                                fgColor={"#000000"}
                                level={"Q"}
                                includeMargin={false}
                            />
                        </div>
                        <div className="text-center">
                            <Avatar className="h-12 w-12 mx-auto mb-2 border-2 border-primary">
                                <AvatarImage src={user.profile_photo || "/avatars/default.png"} alt={user.full_name} />
                                <AvatarFallback>{user.first_name?.[0]}{user.last_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <p className="font-bold text-base">{user.full_name}</p>
                            <div className="flex items-center justify-center gap-1 mt-1 text-muted-foreground">
                                <p className="font-mono text-xs">{user.id_wallet}</p>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyToClipboard}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
                 <Button variant="outline" className="w-full" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    {isClient ? t('receiptPrintButton') : 'Print Receipt'}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleSharePdf}>
                    <Share2 className="mr-2 h-4 w-4" />
                    {isClient ? t('shareAsPdf') : 'Share as PDF'}
                </Button>
            </div>
        </div>
    );
}
