import { MoreHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function UsersPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <Card>
        <CardHeader>
            <CardTitle>Utilisateurs</CardTitle>
            <CardDescription>
            Gérez les utilisateurs de votre système, mutez-les et changez leurs rôles.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="hidden md:table-cell">Magasin</TableHead>
                <TableHead className="hidden md:table-cell">Statut</TableHead>
                <TableHead className="hidden md:table-cell">Date d'embauche</TableHead>
                <TableHead>
                    <span className="sr-only">Actions</span>
                </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                <TableCell className="font-medium">
                    <div className="font-medium">Jean Dupont</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                        jean.dupont@example.com
                    </div>
                </TableCell>
                <TableCell>Caissier</TableCell>
                <TableCell className="hidden md:table-cell">
                    Supermarché de la Cité
                </TableCell>
                <TableCell className="hidden md:table-cell">
                    <Badge variant="outline">Actif</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                    2023-01-15
                </TableCell>
                <TableCell>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                    </Button>
                </TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium">
                    <div className="font-medium">Amina Diallo</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                        amina.diallo@example.com
                    </div>
                </TableCell>
                <TableCell>Gestionnaire de stock</TableCell>
                <TableCell className="hidden md:table-cell">
                    Pharmacie Centrale
                </TableCell>
                <TableCell className="hidden md:table-cell">
                    <Badge variant="outline">Actif</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                    2022-10-20
                </TableCell>
                <TableCell>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                    </Button>
                </TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium">
                    <div className="font-medium">Paul Martin</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                        paul.martin@example.com
                    </div>
                </TableCell>
                <TableCell>Manager</TableCell>
                <TableCell className="hidden md:table-cell">
                    Supermarché du Port
                </TableCell>
                 <TableCell className="hidden md:table-cell">
                    <Badge variant="destructive">Inactif</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                    2021-03-05
                </TableCell>
                <TableCell>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                    </Button>
                </TableCell>
                </TableRow>
            </TableBody>
            </Table>
        </CardContent>
        </Card>
    </main>
  )
}
