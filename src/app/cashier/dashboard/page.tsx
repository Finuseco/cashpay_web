'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, ShoppingCart, ArrowDown, ArrowUp } from 'lucide-react';
import { openCashRegister, closeCashRegister } from '@/actions/cash-register.actions';

// --- Données Fictives (à remplacer par les données de session réelles) ---
const session = {
  id: 1, // Supposons que l'ID de la session active est 1
  status: 'open', // 'open' | 'closed'
  openingBalance: 50000,
  totalSales: 275500,
  totalExpenses: 32000,
};

const currentBalance = session.openingBalance + session.totalSales - session.totalExpenses;
// --- Fin des Données Fictives ---

export default function CashierDashboard() {

  const handleOpenRegister = openCashRegister.bind(null, { 
    userId: 1, // A remplacer par le vrai ID de l'utilisateur connecté
    storeId: 1, // A remplacer par le vrai ID du magasin
    openingBalance: 50000 // Montant du fonds de caisse initial
  });

  const handleCloseRegister = closeCashRegister.bind(null, session.id);


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Statut de la Session
            </CardTitle>
            <div className={`h-4 w-4 rounded-full ${session.status === 'open' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{session.status === 'open' ? 'Ouverte' : 'Fermée'}</div>
            <p className="text-xs text-muted-foreground">
              Session actuelle de la caisse
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventes de la Session</CardTitle>
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{session.totalSales.toLocaleString('fr-CD')} CDF</div>
            <p className="text-xs text-muted-foreground">
              Total des ventes enregistrées
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dépenses de la Session</CardTitle>
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              - {session.totalExpenses.toLocaleString('fr-CD')} CDF
            </div>
            <p className="text-xs text-muted-foreground">
              Total des dépenses enregistrées
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde Actuel en Caisse</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentBalance.toLocaleString('fr-CD')} CDF</div>
            <p className="text-xs text-muted-foreground">
              Basé sur les transactions de la session
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/cashier/pos" className="flex-1">
          <Button size="lg" className="w-full text-lg py-8" disabled={session.status === 'closed'}>
            <ShoppingCart className="mr-2 h-6 w-6" /> Accéder au Point de Vente
          </Button>
        </Link>
        <div className="flex gap-4">
            {session.status === 'closed' && (
              <form action={handleOpenRegister}>
                <Button type="submit" variant="outline" size="lg">Ouvrir la Caisse</Button>
              </form>
            )}
            {session.status === 'open' && (
              <form action={handleCloseRegister}>
                 <Button type="submit" variant="destructive" size="lg">Clôturer la Caisse</Button>
              </form>
            )}
        </div>
      </div>
       <Card>
          <CardHeader>
            <CardTitle>Transactions Récentes de la Session</CardTitle>
            <CardDescription>
              Liste des dernières ventes et dépenses que vous avez enregistrées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Ici, on pourrait ajouter un tableau des transactions de la session */}
            <p className="text-muted-foreground">Le journal des transactions de la session apparaîtra ici.</p>
          </CardContent>
        </Card>
    </main>
  );
}
