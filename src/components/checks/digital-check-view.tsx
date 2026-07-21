
'use client';

import { format } from "date-fns";
import { fr } from 'date-fns/locale';
import type { User, DigitalCheck } from '@/lib/types';
import { Logo } from '../logo';

// Function to convert a number to its full text representation in French
const numberToWordsFrench = (num: number): string => {
  // This is a simplified version. A full implementation would be more complex.
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];
  
  if (num === 0) return 'zéro';
  // For simplicity, we'll just return the number as a string for this mock
  return num.toString();
};

export function DigitalCheckView({ check, issuer }: { check: DigitalCheck, issuer: User }) {
    const issueDateFormatted = format(new Date(check.issueDate), "dd / MM / yyyy", { locale: fr });
    const amountInWords = numberToWordsFrench(check.amount);

    return (
        <div id="printable-check" className="bg-white text-black font-serif p-4 border-2 border-zinc-800 rounded-lg shadow-lg relative w-full max-w-md mx-auto text-[10px]">
            <div className="absolute top-2 right-2 text-zinc-600 font-sans">
                <p>No. <span className="text-red-600 font-mono">{check.checkNumber}</span></p>
            </div>

            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg">{issuer.full_name}</p>
                    <p>{issuer.address}</p>
                    <p>{issuer.phone}</p>
                </div>
                <Logo className="w-24"/>
            </div>

            <div className="mt-4 flex justify-between items-baseline">
                <p>Date: <span className="font-mono underline decoration-dotted">{issueDateFormatted}</span></p>
                <div className="border-2 border-black p-1 px-2">
                    <span className="font-sans font-bold text-lg">{check.currency}</span>
                    <span className="font-mono font-bold text-lg tracking-wider"> {check.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            <div className="mt-4">
                <div className="flex items-center">
                    <span className="font-bold mr-2">PAYEZ À L'ORDRE DE:</span>
                    <p className="flex-1 border-b-2 border-dotted border-black p-1 font-sans font-semibold text-base">{check.recipientName}</p>
                </div>
                <div className="flex items-center mt-2">
                    <span className="font-bold mr-2">LA SOMME DE:</span>
                    <p className="flex-1 border-b-2 border-dotted border-black p-1 font-sans capitalize">{amountInWords} {check.currency}</p>
                </div>
            </div>

            <div className="mt-8 flex justify-between items-end">
                <div className="w-2/3">
                    <p className="text-xs">Memo: Paiement via CashPay</p>
                    <div className="border-b-2 border-dotted border-black mt-1"></div>
                </div>
                <div className="w-1/3 text-center">
                    <div className="relative h-12 w-full">
                       {issuer.signature_image && <img src={issuer.signature_image} alt="Signature" className="mx-auto h-full object-contain" />}
                    </div>
                    <p className="border-t-2 border-black font-bold pt-1">SIGNATURE AUTORISÉE</p>
                </div>
            </div>
        </div>
    );
};
