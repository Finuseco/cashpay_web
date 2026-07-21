

'use client';

import { useRef } from 'react';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { cn } from '@/lib/utils';
import { Logo } from '../logo';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { Printer, Share2, CheckCircle } from 'lucide-react';
import { getCountryByCode } from '@/lib/utils';


type SendDetails = {
    amountToSend: number;
    currency: string;
    fee: number;
    totalDebit: number;
    debitCurrency: string;
    exchangeRate?: number;
    recipientReceives?: number;
    recipientName?: string;
    recipientCountry?: string;
};

interface ReceiptProps {
  details: SendDetails;
  reference: string;
  sender: User;
}

const ReceiptLayout = ({ details, reference, sender, isPdf = false }: ReceiptProps & { isPdf?: boolean }) => {
    const countryInfo = getCountryByCode(details.recipientCountry || '');
    const debitSymbol = details.debitCurrency === 'USD' ? '$' : details.debitCurrency === 'EUR' ? '€' : 'FC';
    const recipientCurrencySymbol = countryInfo?.currency_symbol || '';
    
    return (
        <div className={cn("bg-background text-foreground font-sans p-4", isPdf ? "text-black bg-white" : "max-w-md mx-auto")}>
            <div className="text-center mb-4">
                 {isPdf ? ( <img src="/logos/logo.png" alt="CashPay Logo" style={{ width: '8rem', margin: '0 auto' }} /> ) : ( <Logo className="w-32 mx-auto" /> )}
            </div>

            <p className="text-center font-semibold text-lg">REÇU DE TRANSFERT INTERNATIONAL</p>
            <p className="text-center text-xs text-muted-foreground mb-4">Réf: {reference}</p>
            
            <div className="text-sm space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">EXPÉDITEUR</p>
                    <p className="font-semibold">{sender.full_name}</p>
                    <p className="font-mono text-xs">{sender.id_wallet}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">BÉNÉFICIAIRE</p>
                    <p className="font-semibold">{details.recipientName}</p>
                    <p className="text-xs">{countryInfo?.name || details.recipientCountry}</p>
                </div>
            </div>

            <Separator className="my-4"/>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Montant envoyé</span><span className="font-semibold">{debitSymbol}{details.amountToSend.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Frais</span><span className="font-semibold">{debitSymbol}{details.fee.toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2"><span className="text-muted-foreground">Total débité</span><span>{debitSymbol}{details.totalDebit.toFixed(2)} {details.debitCurrency}</span></div>
            </div>
            
            <Separator className="my-4"/>
            
            {details.recipientReceives && (
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                    <p className="text-sm text-green-700">Le bénéficiaire reçoit environ</p>
                    <p className="text-2xl font-bold text-green-600">{recipientCurrencySymbol} {details.recipientReceives.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</p>
                </div>
            )}
            
            <p className="text-center text-xs mt-6 text-muted-foreground">Merci d'utiliser CashPay.</p>
        </div>
    );
}

export function InternationalTransferReceipt(props: ReceiptProps) {
    const pdfRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        window.print();
    };

    const handleSharePdf = async () => {
        const element = pdfRef.current;
        if (!element) return;
        
        const html2canvas = (await import('html2canvas')).default;
    
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, windowWidth: element.scrollWidth, windowHeight: element.scrollHeight });
        
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a5' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`cashpay-receipt-${props.reference}.pdf`);
    };

    return (
        <div>
            <div className="hidden">
                <div ref={pdfRef} style={{ width: '148mm' }}>
                    <ReceiptLayout {...props} isPdf={true} />
                </div>
            </div>
            <DialogHeader>
                <div className="text-center pb-4">
                     <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <DialogTitle>Transfert Réussi</DialogTitle>
                    <DialogDescription>Le transfert a été envoyé avec succès. Le reçu est prêt.</DialogDescription>
                </div>
            </DialogHeader>

            <div id="receipt-content">
                <ReceiptLayout {...props} />
            </div>
            
            <DialogFooter className="flex-col sm:flex-col sm:space-y-2 mt-4">
                <Button onClick={handleSharePdf} className="w-full" variant="secondary"><Share2 className="mr-2 h-4 w-4" /> Partager en PDF</Button>
                <Button onClick={handlePrint} className="w-full" variant="outline"><Printer className="mr-2 h-4 w-4" /> Imprimer le reçu</Button>
                <DialogClose asChild><Button className="w-full">Fermer</Button></DialogClose>
            </DialogFooter>
        </div>
    );
}
