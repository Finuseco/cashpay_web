// src/app/shopping/vouchers/page.tsx
'use client';

import { useState } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Link from 'next/link';

interface Voucher {
    id: number;
    amount: number;
    currency: string;
    minOrder: number;
    seller: string;
    validity: string;
    status: 'available' | 'used' | 'expired';
}

const mockVouchers: Voucher[] = [
    { id: 1, amount: 680, currency: 'CDF', minOrder: 10200, seller: 'XY 3C', validity: '13th Jun 2025-27th Feb 2026', status: 'available' },
    { id: 2, amount: 680, currency: 'CDF', minOrder: 17000, seller: 'YM Wholesale', validity: '13th Jun 2025-28th Feb 2026', status: 'available' },
    { id: 3, amount: 340, currency: 'CDF', minOrder: 10200, seller: 'YM Wholesale', validity: '13th Jun 2025-28th Feb 2026', status: 'available' },
    { id: 4, amount: 500, currency: 'CDF', minOrder: 15000, seller: 'Tech Gadgets', validity: '1st Jul 2024-31st Jul 2024', status: 'used' },
    { id: 5, amount: 1000, currency: 'CDF', minOrder: 25000, seller: 'Fashion Hub', validity: '1st Jan 2024-31st Mar 2024', status: 'expired' },
];

const VoucherCard = ({ voucher }: { voucher: Voucher }) => {
    const { openAlert } = useAlertDialog();
    
    const handleUseCoupon = () => {
        openAlert({
            title: "Coupon Appliqué",
            description: "Ce coupon sera appliqué automatiquement lors de votre prochain achat éligible.",
            variant: "success",
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-sm mb-3">
            <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-4 rounded-t-lg flex justify-between items-center">
                <div>
                    <span className="text-3xl font-bold">{voucher.amount.toLocaleString()} {voucher.currency}</span>
                    <span className="font-semibold ml-1">OFF</span>
                    <p className="text-xs">Votre commande de {voucher.minOrder.toLocaleString()} {voucher.currency} ou plus</p>
                </div>
                {voucher.status === 'available' && (
                    <Button 
                        onClick={handleUseCoupon}
                        className="bg-white text-pink-600 rounded-full font-bold h-8 px-4 hover:bg-gray-100"
                    >
                        Utiliser (coupon)
                    </Button>
                )}
            </div>
            <div className="p-3 text-sm text-gray-600">
                <p>De: <span className="font-semibold">{voucher.seller}</span></p>
                <p>Utilise le dans <Link href="#" className="text-primary font-semibold">{voucher.seller}</Link></p>
                <p>Valid: <span className="font-semibold">{voucher.validity}</span></p>
            </div>
        </div>
    );
};


export default function VouchersPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('available');

    const filteredVouchers = mockVouchers.filter(v => v.status === activeTab);

    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="sticky top-0 bg-white z-10 shadow-sm flex items-center justify-between p-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="font-bold text-lg">My Voucher</h1>
                <Button variant="ghost" size="icon">
                    <HelpCircle />
                </Button>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-white rounded-none border-b">
                    <TabsTrigger value="available" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">Disponible</TabsTrigger>
                    <TabsTrigger value="used" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">Utilisé</TabsTrigger>
                    <TabsTrigger value="expired" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">Expiré</TabsTrigger>
                </TabsList>
                
                <TabsContent value="available" className="p-2">
                    {filteredVouchers.map(v => <VoucherCard key={v.id} voucher={v} />)}
                </TabsContent>
                <TabsContent value="used" className="p-2">
                    {filteredVouchers.length > 0 
                        ? filteredVouchers.map(v => <VoucherCard key={v.id} voucher={v} />)
                        : <div className="text-center py-20 text-gray-500">Aucun coupon utilisé.</div>
                    }
                </TabsContent>
                <TabsContent value="expired" className="p-2">
                    {filteredVouchers.length > 0 
                        ? filteredVouchers.map(v => <VoucherCard key={v.id} voucher={v} />)
                        : <div className="text-center py-20 text-gray-500">Aucun coupon expiré.</div>
                    }
                </TabsContent>
            </Tabs>
        </div>
    );
}
