'use client';

import { useRef, useEffect, useState } from 'react';
import { useTranslation } from "react-i18next";
import { Printer, Share2, Loader2, ShieldCheck, Usb, UserCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import jsPDF from 'jspdf';
import { cn } from '@/lib/utils';
import type { Transaction, User } from '@/lib/types';
import { getReceiptLogoBase64 } from '@/lib/actions/transaction.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { QRCodeSVG } from 'qrcode.react';

interface TransactionReceiptProps {
  transaction: Transaction;
}


const ReceiptLayout = ({ transaction, user, isPdf = false, logoBase64, hideLogo = false }: { transaction: Transaction, user: User, isPdf?: boolean, logoBase64?: string | null, hideLogo?: boolean }) => {
    const { t } = useTranslation();
    const principalAmount = parseFloat(transaction.amount);
    const feeAmount = transaction.fee || 0;
    const totalAmount = transaction.type === 'sent' ? principalAmount + feeAmount : principalAmount;
    
    const isSender = transaction.type === 'sent';
    const isHsm = transaction.metadata?.typeCode === 'HSM_LOCK' || transaction.metadata?.typeCode === 'B2B_HSM_ISSUE' || transaction.metadata?.hsm_recovery === true;

    return (
        <div className={cn(
            "font-mono text-xs text-black bg-white p-2 w-[80mm] mx-auto",
            isPdf ? "" : "max-w-xs text-foreground bg-background"
        )}>
            {!hideLogo && (
                <div className="text-center mb-2">
                    {isPdf && logoBase64 ? (
                        <img id="pdf-logo" src={logoBase64} alt="CashPay Logo" style={{ width: '8rem', margin: '0 auto' }} />
                    ) : (
                        <Logo className="w-24 mx-auto" />
                    )}
                </div>
            )}

            <p className={cn("text-center text-[10px] mt-1 uppercase font-bold", isPdf ? "text-gray-600": "text-primary")}>
                {isHsm ? "Certificat de Valeur Souverain" : t('receiptOfficial')}
            </p>
            <Separator className={cn("my-2 border-dashed", isPdf ? "border-black bg-black" : "")} />

            <div className="space-y-1 text-[10px]">
                <div className="flex justify-between"><span className={cn(isPdf ? "text-gray-600" : "text-muted-foreground")}>{t('receiptDate')}:</span><span>{transaction.date} {transaction.time}</span></div>
                <div className="flex justify-between"><span className={cn(isPdf ? "text-gray-600" : "text-muted-foreground")}>{t('receiptReference')}:</span><span className="font-semibold break-all">{transaction.reference}</span></div>
                <div className="flex justify-between"><span className={cn(isPdf ? "text-gray-600" : "text-muted-foreground")}>Type:</span><span className="font-semibold break-all uppercase">{isHsm ? 'Hardware Value Asset' : transaction.description}</span></div>
            </div>

            <Separator className="my-2 border-dashed" />

             <div className="space-y-1 text-xs">
                 {/* Traçabilité CPK */}
                 {isHsm && (
                    <div className="p-2 bg-primary/5 rounded-md mb-2 border border-primary/10">
                        <div className="flex justify-between items-baseline">
                            <span className="text-[8px] text-zinc-500 uppercase font-bold">Émetteur original</span>
                            <span className="font-bold text-[10px]">{transaction.metadata?.issuerName || 'CashPay Network'}</span>
                        </div>
                        {transaction.metadata?.recipientName && (
                            <div className="flex justify-between items-baseline mt-1">
                                <span className="text-[8px] text-zinc-500 uppercase font-bold">Bénéficiaire final</span>
                                <span className="font-bold text-[10px] text-green-600">{transaction.metadata?.recipientName}</span>
                            </div>
                        )}
                    </div>
                 )}

                 {!isHsm && (
                     <>
                        <div className="flex justify-between">
                            <span className={cn(isPdf ? "text-gray-600" : "text-muted-foreground")}>{t('receiptSender')}</span>
                            <span className="font-semibold">{transaction.metadata?.senderName || 'N/A'}</span>
                        </div>
                        {transaction.metadata?.receiverName && (
                            <div className="flex justify-between">
                                <span className={cn(isPdf ? "text-gray-600" : "text-muted-foreground")}>{t('receiptRecipient')}</span>
                                <span className="font-semibold">{transaction.metadata.receiverName}</span>
                            </div>
                        )}
                     </>
                 )}
             </div>
             
             <Separator className="my-2 border-dashed" />
            
            <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                    <span className={cn(isPdf ? "text-gray-600" : "text-muted-foreground")}>{t('receiptPrincipalAmount')}</span>
                    <span className="font-semibold">{transaction.currency}{principalAmount.toFixed(2)}</span>
                </div>
                {isSender && (
                  <div className="flex justify-between">
                      <span className={cn(isPdf ? "text-gray-600" : "text-muted-foreground")}>{t('receiptFee')}</span>
                      <span className="font-semibold">{transaction.currency}{(feeAmount || 0).toFixed(2)}</span>
                  </div>
                )}
            </div>
            <Separator className="my-1 border-black" />
            <div className="flex justify-between font-bold text-sm mt-1">
                <span>{isSender ? t('receiptTotalDebited') : t('receiptTotalCredited')}</span>
                <span>
                    {transaction.type === 'sent' ? '-' : '+'}
                    {transaction.currency}
                    {totalAmount.toFixed(2)}
                </span>
            </div>
            
            <Separator className="my-2 border-dashed" />

             <div className="flex justify-center my-2">
                <div className="bg-white p-1 rounded-sm">
                    <QRCodeSVG
                        value={transaction.reference}
                        size={80}
                        bgColor={"#FFFFFF"}
                        fgColor={"#000000"}
                        level={"Q"}
                        includeMargin={false}
                    />
                </div>
            </div>

            <p className={cn("text-center text-[10px] mt-4", isPdf ? "text-gray-500" : "text-muted-foreground")}>
                {t('receiptFooter')}
            </p>
        </div>
    );
};


export function TransactionReceipt({ transaction }: { transaction: Transaction }) {
    const { t } = useTranslation();
    const pdfRef = useRef<HTMLDivElement>(null);
    const { openAlert } = useAlertDialog();
    const [logoBase64, setLogoBase64] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    
    // Auth placeholder fixed with all required fields
    const mockUser: User = { 
        id: 1, 
        full_name: 'Utilisateur', 
        email: 'user@test.com', 
        phone: '+2430000000', 
        id_wallet: 'CD0000000000', 
        role: 'Client', 
        status: 'Active',
        account_type: 'national', 
        notifications_channel: ['sms'], 
        country: 'CD', 
        created_at: new Date().toISOString(), 
        language: 'fr',
        is_crypto_active: false
    };

    useEffect(() => {
        getReceiptLogoBase64().then(setLogoBase64);
    }, []);

    const handlePrint = () => {
        window.print();
    };
    
    const svgToDataURL = (svgString: string): Promise<string> => {
        return new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                const context = canvas.getContext('2d');
                if (context) {
                    context.drawImage(image, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                }
            };
            image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
        });
    };

    const handleSharePdf = async () => {
        setIsSharing(true);
        try {
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: [80, 160]
            });
    
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(0, 0, 0);
    
            let y = 10;
    
            if (logoBase64) {
                pdf.addImage(logoBase64, 'PNG', 20, y, 40, 10);
                y += 12;
            }
    
            pdf.setFontSize(8);
            pdf.text("Reçu Officiel", 40, y, { align: 'center' });
            y += 5;
            
            pdf.setFontSize(7);
            pdf.text(`Réf: ${transaction.reference}`, 40, y, { align: 'center' });
            y += 7;
    
            pdf.setLineDashPattern([0.5, 0.5], 0);
            pdf.line(5, y, 75, y);
            y += 5;
    
            pdf.text(`Date: ${transaction.date} ${transaction.time}`, 5, y);
            y += 5;

            const isHsm = transaction.metadata?.typeCode === 'HSM_LOCK' || transaction.metadata?.typeCode === 'B2B_HSM_ISSUE' || transaction.metadata?.hsm_recovery === true;
            const typeDisplay = isHsm ? 'HARDWARE VALUE ASSET' : t(`receiptType${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}`, transaction.description);
            pdf.text(`Type: ${typeDisplay}`, 5, y);
            y += 7;

            pdf.line(5, y, 75, y);
            y += 5;
            
            if (isHsm) {
                pdf.text(`Émetteur: ${transaction.metadata?.issuerName || 'CashPay'}`, 5, y);
                y += 5;
                if (transaction.metadata?.recipientName) {
                    pdf.text(`Bénéficiaire: ${transaction.metadata.recipientName}`, 5, y);
                    y += 7;
                } else {
                    y += 2;
                }
            } else {
                const senderName = transaction.metadata?.senderName || 'N/A';
                const receiverName = transaction.metadata?.receiverName || 'N/A';
                pdf.text(`De: ${senderName}`, 5, y);
                y += 5;
                if(receiverName !== 'N/A') {
                    pdf.text(`À: ${receiverName}`, 5, y);
                    y += 7;
                } else {
                     y += 2;
                }
            }
            
            pdf.line(5, y, 75, y);
            y += 5;
    
            pdf.setFontSize(8);
            const principalAmount = parseFloat(transaction.amount);
            const feeAmount = transaction.fee || 0;
            const totalAmount = transaction.type === 'sent' ? principalAmount + feeAmount : principalAmount;
            
            pdf.text("Montant Principal:", 5, y);
            pdf.text(`${transaction.currency}${principalAmount.toFixed(2)}`, 75, y, { align: 'right' });
            y += 5;
    
            if(transaction.type === 'sent') {
              pdf.text("Frais:", 5, y);
              pdf.text(`${transaction.currency}${feeAmount.toFixed(2)}`, 75, y, { align: 'right' });
              y += 5;
            }
    
            pdf.setLineWidth(0.5);
            pdf.line(5, y, 75, y);
            y += 5;
    
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "bold");
            pdf.text(transaction.type === 'sent' ? 'Total Débité:' : 'Total Crédité:', 5, y);
            const totalText = `${transaction.type === 'sent' ? '-' : '+'}${transaction.currency}${totalAmount.toFixed(2)}`;
            pdf.text(totalText, 75, y, { align: 'right' });
            y += 7;
            
            const qrCodeSVGString = new XMLSerializer().serializeToString(
                document.querySelector('#qr-code-for-pdf')!
            );
            const qrCodeDataUrl = await svgToDataURL(qrCodeSVGString);
            
            pdf.addImage(qrCodeDataUrl, 'PNG', 25, y, 30, 30);
            y += 35;
    
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.text("Merci d'utiliser CashPay.", 40, y, { align: 'center' });
    
            pdf.save(`cashpay-receipt-${transaction.reference}.pdf`);
    
        } catch (error) {
            console.error("PDF generation failed:", error);
            openAlert({
                title: 'Erreur PDF',
                description: 'Une erreur est survenue lors de la création du PDF.',
                variant: 'error'
            });
        } finally {
            setIsSharing(false);
        }
    };
    

    return (
        <div>
             <div className="hidden">
                 <QRCodeSVG 
                    id="qr-code-for-pdf"
                    value={transaction.reference}
                    size={256}
                    bgColor={"#FFFFFF"}
                    fgColor={"#000000"}
                    level={"Q"}
                 />
            </div>
            
            <div id="printable-receipt" className="print:hidden">
                <ReceiptLayout transaction={transaction} user={mockUser} logoBase64={logoBase64} />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-6 print:hidden">
                <Button onClick={handlePrint} className="w-full" variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    {t('receiptPrintButton')}
                </Button>
                <Button onClick={handleSharePdf} className="w-full" variant="secondary" disabled={isSharing}>
                    {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Share2 className="mr-2 h-4 w-4" />}
                    {t('shareAsPdf')}
                </Button>
            </div>
        </div>
    );
}