import Link from 'next/link';
import { ShoppingCart, LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/cashier/dashboard"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <ShoppingCart className="h-6 w-6" />
            <span className="">Caisse</span>
          </Link>
          <Link
            href="/cashier/dashboard"
            className="text-foreground transition-colors hover:text-foreground"
          >
            <LayoutDashboard className="h-4 w-4 mr-1 inline-block" />
            Tableau de Bord
          </Link>
          <Link
            href="/cashier/pos"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ShoppingCart className="h-4 w-4 mr-1 inline-block" />
            Point de Vente
          </Link>
        </nav>
        <div>
            <Button variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-1" />
                Déconnexion
            </Button>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
