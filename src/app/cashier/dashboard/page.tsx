'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, LayoutDashboard } from 'lucide-react';
import { openCashRegister, closeCashRegister } from '@/lib/actions/cash-register.actions';

const session = {
  id: 1,
  status: 'open',
  openingBalance: 50000,
  totalSales: 275500,
  totalExpenses: 32000,
};

export default function CashierDashboard() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Statut Caisse</CardTitle>
            <div className={`h-4 w-4 rounded-full ${session.status === 'open' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{session.status === 'open' ? 'Ouverte' : 'Fermée'}</div>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/cashier/pos" className="flex-1">
          <Button size="lg" className="w-full text-lg py-8" disabled={session.status === 'closed'}>
            <ShoppingCart className="mr-2 h-6 w-6" /> Accéder au Point de Vente
          </Button>
        </Link>
      </div>
    </main>
  );
}
