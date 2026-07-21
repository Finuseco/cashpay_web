
'use client';

import React from 'react';
import Barcode from 'react-barcode';
import { useTranslation } from "react-i18next";
import { Logo } from '@/components/logo';
import { Separator } from '@/components/ui/separator';

interface ReceiptItem {
    id: string;
    name: string;
    qty?: number;
    quantity?: number; // Accept both for flexibility
    price?: number; 
    total?: number;
}

interface PosReceiptProps {
  items: ReceiptItem[];
  total: number; 
  tva?: number;
  reference?: string;
  boutiqueName: string;
  date?: string;
  buyerName?: string;
}

export function PosReceipt({ items = [], total, tva, reference, boutiqueName, date: transactionDate, buyerName }: PosReceiptProps) {
  const { t } = useTranslation();
  const date = transactionDate ? new Date(transactionDate) : new Date();
  const finalReference = reference || 'N/A';
  
  const tvaAmount = tva || 0;
  const subTotal = total - tvaAmount;


  return (
    <div className="font-mono text-xs text-black bg-white p-2 w-[80mm] mx-auto">
      <div className="text-center mb-2">
        <Logo className="w-24 mx-auto" />
        <p className="font-bold mt-1">{boutiqueName}</p>
      </div>
      <Separator className="my-1 border-dashed border-black bg-black" />
      <div className="text-left mb-1">
        <p>{t('receiptDate')}: {date.toLocaleDateString('fr-FR')}</p>
        <p>{t('receiptTime')}: {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
        {buyerName && <p>{t('receiptClient')}: {buyerName}</p>}
      </div>
      <Separator className="my-1 border-dashed border-black bg-black" />
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left font-bold pb-1">{t('receiptItem')}</th>
            <th className="text-center font-bold pb-1">{t('receiptQty')}</th>
            <th className="text-right font-bold pb-1">{t('receiptPrice')}</th>
            <th className="text-right font-bold pb-1">{t('receiptTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const itemQuantity = item.quantity || item.qty || 0;
            const itemTotal = item.total !== undefined ? item.total : (item.price || 0) * itemQuantity;
            const itemPrice = item.price !== undefined ? item.price : (itemQuantity > 0 ? itemTotal / itemQuantity : 0);

            return (
              <tr key={item.id}>
                <td className="w-1/2 break-words pr-1">{item.name}</td>
                <td className="text-center">{itemQuantity}</td>
                <td className="text-right">${itemPrice.toFixed(2)}</td>
                <td className="text-right font-semibold">${itemTotal.toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Separator className="my-1 border-dashed border-black bg-black" />
      <div className="space-y-0.5 mt-2">
        <div className="flex justify-between">
          <span>{t('receiptSubtotal')}</span>
          <span className="font-bold">${subTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('receiptVat')}</span>
          <span className="font-bold">${tvaAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm mt-1 border-t border-black pt-1">
          <span>{t('receiptTotalToPay')}</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>
      <Separator className="my-1 border-dashed border-black bg-black" />
      <div className="text-center mt-2">
        <p>{t('receiptThankYou')}</p>
        <div className="flex justify-center mt-2">
          <Barcode value={finalReference} height={40} width={1.5} fontSize={10} margin={0} />
        </div>
      </div>
    </div>
  );
}
