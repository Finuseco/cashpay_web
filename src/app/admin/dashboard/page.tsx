import {
    Activity,
    CreditCard,
    DollarSign,
    Users,
    ArrowDown,
  } from 'lucide-react';
  import Link from 'next/link';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';
  import { Progress } from '@/components/ui/progress';
  import { Button } from '@/components/ui/button';
  
  
  export default function Dashboard() {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
          <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
            <Link
              href="#"
              className="flex items-center gap-2 text-lg font-semibold md:text-base"
            >
              <Users className="h-6 w-6" />
              <span className="sr-only">Admin Panel</span>
            </Link>
            <Link
              href="/admin/dashboard"
              className="text-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/users"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Utilisateurs
            </Link>
            <a
              href="#"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Produits
            </a>
            <a
              href="#"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Ventes
            </a>
            <a
              href="#"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Rapports
            </a>
          </nav>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenus
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12 540 231 CDF</div>
                <p className="text-xs text-muted-foreground">
                  +20.1% depuis le mois dernier
                </p>
              </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Dépenses</CardTitle>
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive">- 850 450 CDF</div>
                    <p className="text-xs text-muted-foreground">
                        +5.2% depuis le mois dernier
                    </p>
                </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ventes</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+12,234</div>
                <p className="text-xs text-muted-foreground">
                  +19% depuis le mois dernier
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Employés Actifs</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+573</div>
                <p className="text-xs text-muted-foreground">
                  dans 12 magasins
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                  <CardHeader>
                      <CardTitle>Transactions Récentes</CardTitle>
                      <CardDescription>
                          Journal des ventes et des dépenses de tous les magasins.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Client / Description</TableHead>
                                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                                  <TableHead className="hidden sm:table-cell">Paiement</TableHead>
                                  <TableHead className="hidden md:table-cell">Date</TableHead>
                                  <TableHead className="text-right">Montant</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              <TableRow>
                                  <TableCell>
                                      <div className="font-medium">Liam Johnson</div>
                                      <div className="hidden text-sm text-muted-foreground md:inline">
                                          liam@example.com
                                      </div>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                      <Badge variant="secondary">Vente</Badge>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                      <Badge variant="outline">Cash</Badge>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">2023-06-23</TableCell>
                                  <TableCell className="text-right">250 000 CDF</TableCell>
                              </TableRow>
                              <TableRow>
                                  <TableCell>
                                      <div className="font-medium">Fournitures de bureau</div>
                                      <div className="hidden text-sm text-muted-foreground md:inline">
                                          Effectué par A. Diallo
                                      </div>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                      <Badge variant="destructive">Dépense</Badge>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                      <Badge variant="outline">Cash</Badge>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">2023-06-25</TableCell>
                                  <TableCell className="text-right text-destructive">- 55 000 CDF</TableCell>
                              </TableRow>
                              <TableRow>
                                  <TableCell>
                                      <div className="font-medium">Olivia Smith</div>
                                      <div className="hidden text-sm text-muted-foreground md:inline">
                                          olivia@example.com
                                      </div>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <Badge variant="secondary">Vente</Badge>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                      <Badge className="text-xs" variant="outline">
                                          Carte
                                      </Badge>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">2023-06-24</TableCell>
                                  <TableCell className="text-right">150 000 CDF</TableCell>
                              </TableRow>
                          </TableBody>
                      </Table>
                  </CardContent>
              </Card>
              <Card>
                  <CardHeader>
                    <CardTitle>Performance des Magasins</CardTitle>
                    <CardDescription>
                        Revenus mensuels de chaque magasin.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-8">
                      <div className="flex flex-col gap-4">
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-medium leading-none">Magasin de la Cité</p>
                                <span className="text-sm font-bold">5 231 890 CDF</span>
                            </div>
                            <Progress value={85} aria-label="85% des revenus" />
                        </div>
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-medium leading-none">Supermarché du Port</p>
                                <span className="text-sm font-bold">3 542 320 CDF</span>
                            </div>
                            <Progress value={60} aria-label="60% des revenus" />
                        </div>
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-medium leading-none">Pharmacie Centrale</p>
                                <span className="text-sm font-bold">1 899 500 CDF</span>
                            </div>
                            <Progress value={30} aria-label="30% des revenus" />
                        </div>
                        <Button variant="outline" size="sm" className="mt-2">
                            Voir tous les rapports
                        </Button>
                      </div>
                  </CardContent>
              </Card>
          </div>
        </main>
      </div>
    );
  }
    