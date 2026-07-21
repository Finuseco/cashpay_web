'use client';

import { useRef, useState, useEffect } from 'react';
import type { Transaction, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Import the autotable plugin
import { cn } from '@/lib/utils';
import { getReceiptLogoBase64 } from '@/lib/actions/transaction.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';
import { useTranslation } from "react-i18next";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Printer, Download, ArrowLeft, User as UserIcon, Building, Banknote, Loader2 } from 'lucide-react';
import { Logo } from '../logo';
import { Card, CardContent } from '../ui/card';

// Extend the jsPDF interface to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}


interface StatementDisplayProps {
    transactions: Transaction[];
    fromDate: Date;
    toDate: Date;
    onBack: () => void;
    user: User;
}

const TransactionPage = ({ transaction, user, logoBase64 }: { transaction: Transaction; user: User, logoBase64: string | null }) => {
    const { t } = useTranslation();
    const isSender = transaction.type === 'sent';
    const otherPartyLabel = isSender ? t('recipientLabel', 'Bénéficiaire') : t('senderLabel', 'Expéditeur');
    const otherPartyName = isSender ? transaction.metadata?.receiverName : transaction.metadata?.senderName;
    const principalAmount = parseFloat(transaction.amount);
    const feeAmount = transaction.fee || 0;
    const totalAmount = transaction.type === 'sent' ? principalAmount + feeAmount : principalAmount;
    
    return (
         <div className="bg-white text-black p-4 font-sans text-xs w-[210mm] border-b border-gray-300">
            {/* Header */}
            <div className="flex justify-between items-center border-b pb-2 border-gray-300">
                {logoBase64 ? <img src={logoBase64} alt="Finuseco Logo" className="h-10 w-auto" /> : <div className="h-10 w-32 bg-gray-200"></div>}
                <div className="text-right">
                    <p className="font-bold text-lg">FINUSECO SA</p>
                    <p className="text-gray-500 text-xs">Congolese Digital Financial Service</p>
                </div>
            </div>

            <h2 className="text-center font-bold my-3 text-xl">Reçu de Transaction</h2>

            {/* Titulaire et Bénéficiaire */}
            <div className="grid grid-cols-2 gap-4">
                <div className="border p-3 rounded-lg flex flex-col">
                    <h3 className="font-bold border-b mb-2 pb-1 flex items-center gap-2 text-sm"><UserIcon className="h-4 w-4"/> Titulaire du compte</h3>
                    <div className="space-y-1 mt-1 text-[10px]">
                        <p><strong>{user.full_name}</strong></p>
                        <p className="text-gray-600">{user.address}, {user.city}, {user.country}</p>
                        <p className="font-mono pt-1">ID: {user.id_wallet}</p>
                    </div>
                </div>
                 <div className="border p-3 rounded-lg flex flex-col">
                    <h3 className="font-bold border-b mb-2 pb-1 flex items-center gap-2 text-sm"><Building className="h-4 w-4"/> {otherPartyLabel}</h3>
                     <div className="space-y-1 mt-1 text-[10px]">
                       <p><strong>{otherPartyName || 'N/A'}</strong></p>
                    </div>
                </div>
            </div>
            
             {/* Détails de la transaction */}
             <div className="mt-3 border p-3 rounded-lg grid grid-cols-3 gap-3">
                   <div className="col-span-2 space-y-2 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div><p className="text-gray-600">Date & Heure:</p><p className="font-semibold">{transaction.date} {transaction.time}</p></div>
                                <div><p className="text-gray-600">Référence:</p><p className="font-semibold font-mono break-all">{transaction.reference}</p></div>
                            </div>
                            <div className="mt-2">
                                <p className="text-gray-600">Description:</p>
                                <p className="font-semibold">{transaction.description}</p>
                            </div>
                        </div>
                        <div className="border-t pt-2 space-y-1">
                             <div className="flex justify-between text-[10px]">
                                <span>Montant:</span>
                                <span className="font-semibold">{transaction.currency} {transaction.amount}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span>Frais:</span>
                                <span className="font-semibold">{transaction.currency} {transaction.fee?.toFixed(2)}</span>
                            </div>
                             <div className="flex justify-between items-baseline font-bold text-base pt-1 border-t mt-1">
                                 <span>Total:</span>
                                 <span className={cn(isSender ? "text-red-600" : "text-green-600")}>
                                    {isSender ? '-' : '+'} {transaction.currency} {totalAmount.toFixed(2)}
                                </span>
                            </div>
                        </div>
                   </div>
                   <div className="col-span-1 flex flex-col items-center justify-center p-1 rounded-lg">
                        <div className="bg-white p-1 rounded-md">
                           <QRCodeSVG value={transaction.reference} size={64} bgColor={"#ffffff"} fgColor={"#000000"} />
                        </div>
                   </div>
             </div>

            {/* Footer */}
            <div className="mt-2 text-center text-[8px] text-gray-500 border-t pt-1">
                <p>Ceci est un document généré par ordinateur et ne nécessite pas de signature.</p>
                <p>Pour toute question, contactez notre centre d'appel au +243853868021.</p>
            </div>
        </div>
    );
};


export function StatementDisplay({ transactions, fromDate, toDate, onBack, user }: StatementDisplayProps) {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const [isSharing, setIsSharing] = useState(false);
    const [logoBase64, setLogoBase64] = useState<string | null>(null);

    useEffect(() => {
        getReceiptLogoBase64().then(setLogoBase64);
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const handleSharePdf = async () => {
        setIsSharing(true);
        try {
            const doc = new jsPDF();
    
            // Add Header
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', 15, 10, 50, 12);
            }
            doc.setFontSize(10);
            doc.text("Relevé de Compte", doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
            doc.setFontSize(8);
            doc.text(`Période du ${format(fromDate, 'dd/MM/yyyy')} au ${format(toDate, 'dd/MM/yyyy')}`, doc.internal.pageSize.getWidth() / 2, 32, { align: 'center' });
    
            doc.text(`Titulaire: ${user.full_name}`, 15, 40);
            doc.text(`ID Portefeuille: ${user.id_wallet}`, 15, 45);
    
            // Prepare table data
            const head = [['Date', 'Description', 'Montant', 'Frais', 'Total', 'Réf.']];
            const body = transactions.map(tx => {
                const total = tx.type === 'sent' ? parseFloat(tx.amount) + (tx.fee || 0) : parseFloat(tx.amount);
                return [
                    `${tx.date} ${tx.time}`,
                    tx.description,
                    `${tx.currency} ${tx.amount}`,
                    `${tx.currency} ${(tx.fee || 0).toFixed(2)}`,
                    `${tx.type === 'sent' ? '-' : '+'} ${tx.currency} ${total.toFixed(2)}`,
                    tx.reference
                ];
            });
    
            doc.autoTable({
                head: head,
                body: body,
                startY: 50,
                headStyles: { fillColor: [0, 14, 56] }, // #000E38
                styles: { fontSize: 8 },
            });
    
            doc.save(`releve-cashpay-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        } catch (error) {
            console.error("PDF generation with autoTable failed:", error);
            openAlert({
                title: 'Erreur PDF',
                description: 'Une erreur est survenue lors de la création du PDF avec autoTable.',
                variant: 'error'
            });
        } finally {
            setIsSharing(false);
        }
    };


    return (
        <div className="space-y-4">
             <style>
                {`
                @media print {
                    body > *:not(#printable-statement-container) {
                        visibility: hidden;
                    }
                    #printable-statement-container, #printable-statement-container * {
                        visibility: visible;
                    }
                    #printable-statement-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .pdf-page {
                        page-break-after: always;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                }
                `}
            </style>
            
            <div className="print:hidden flex justify-between items-center">
                <Button variant="outline" onClick={onBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Nouvelle demande
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" /> Imprimer
                    </Button>
                    <Button onClick={handleSharePdf} disabled={isSharing}>
                         {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Télécharger en PDF
                    </Button>
                </div>
            </div>

            {/* Hidden container for print */}
            <div id="printable-statement-container" className="hidden print:block">
                 <div>
                    <div className="p-4 bg-white text-center text-black">
                        <h1 className="text-xl font-bold">Relevé de Compte</h1>
                        <p className="text-sm">Période du {format(fromDate, 'dd/MM/yyyy')} au {format(toDate, 'dd/MM/yyyy')}</p>
                    </div>
                     {transactions.map(tx => (
                        <div key={tx.reference} className="pdf-page">
                            <TransactionPage transaction={tx} user={user} logoBase64={logoBase64} />
                        </div>
                    ))}
                 </div>
            </div>
            
            {/* Visible container for UI */}
            <div className="space-y-4 print:hidden">
                {transactions.map(tx => (
                    <div key={tx.reference} className="pdf-page-preview">
                        <TransactionPage transaction={tx} user={user} logoBase64={logoBase64} />
                    </div>
                ))}
                 {transactions.length === 0 && (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">Aucune transaction trouvée pour cette période.</CardContent></Card>
                )}
            </div>
        </div>
    );
}
