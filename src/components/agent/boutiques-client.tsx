

"use client";

import { useState, useEffect } from "react";
import { MoreHorizontal, PlusCircle, Trash2, Edit, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { AddEditBoutiqueForm } from "./add-edit-boutique-form";
import type { Boutique, User } from "@/lib/types";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { addOrUpdateBoutique, deleteBoutique } from "@/lib/actions/agent.actions";

export function BoutiquesClient({ initialBoutiques }: { initialBoutiques: Boutique[] }) {
  const { openAlert } = useAlertDialog();
  const [boutiques, setBoutiques] = useState<Boutique[]>(initialBoutiques);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBoutique, setEditingBoutique] = useState<Boutique | null>(null);
  const [agent, setAgent] = useState<User | null>(null);

  useEffect(() => {
    const fetchAgent = async () => {
      const fetchedAgent = await getAuthenticatedUser();
      setAgent(fetchedAgent);
    };
    fetchAgent();
  }, []);

  const handleFormSubmit = async (boutiqueData: Omit<Boutique, 'id' | 'country_code'> & { id?: string }) => {
    if (!agent) {
      openAlert({ variant: 'error', title: 'Erreur', description: 'Agent non authentifié.' });
      return;
    }
    
    const result = await addOrUpdateBoutique(boutiqueData, agent.id);

    if (result.success && result.boutique) {
      if (editingBoutique) {
        setBoutiques(boutiques.map(b => b.id === result.boutique!.id ? result.boutique! : b));
        openAlert({ variant: 'success', title: 'Boutique mise à jour', description: `La boutique "${result.boutique.name}" a été mise à jour.`});
      } else {
        setBoutiques([...boutiques, result.boutique]);
        openAlert({ variant: 'success', title: 'Boutique ajoutée', description: `La boutique "${result.boutique.name}" a été créée.`});
      }
      setIsFormOpen(false);
      setEditingBoutique(null);
    } else {
        openAlert({ variant: 'error', title: 'Erreur', description: result.error || "Impossible d'enregistrer la boutique." });
    }
  };

  const handleEdit = (boutique: Boutique) => {
    setEditingBoutique(boutique);
    setIsFormOpen(true);
  };

  const handleDelete = async (boutiqueId: string) => {
    if (!agent) return;

    openAlert({
      variant: 'warning',
      title: 'Êtes-vous sûr ?',
      description: "Cette action est irréversible et supprimera la boutique.",
      onClose: async () => {
        const result = await deleteBoutique(boutiqueId, agent.id);
        if (result.success) {
            setBoutiques(boutiques.filter(b => b.id !== boutiqueId));
            openAlert({ variant: 'success', title: 'Boutique Supprimée', description: "La boutique a été supprimée avec succès." });
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error || "Impossible de supprimer la boutique." });
        }
      }
    });
  };

  const openAddForm = () => {
    setEditingBoutique(null);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des Boutiques</h1>
          <p className="text-muted-foreground">Créez et gérez vos points de vente.</p>
        </div>
        <Button onClick={openAddForm}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter une boutique
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Liste des Boutiques</CardTitle>
          <CardDescription>La liste de tous vos points de vente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom de la boutique</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boutiques.map((boutique) => (
                <TableRow key={boutique.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Store className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{boutique.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{boutique.address}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEdit(boutique)}>
                          <Edit className="mr-2 h-4 w-4" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDelete(boutique.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingBoutique ? 'Modifier la Boutique' : 'Ajouter une Nouvelle Boutique'}</DialogTitle>
              <DialogDescription>
                Remplissez les informations ci-dessous.
              </DialogDescription>
            </DialogHeader>
            <AddEditBoutiqueForm 
                onFormSubmit={(data) => handleFormSubmit(data)}
                initialData={editingBoutique} 
            />
          </DialogContent>
        </Dialog>
    </div>
  );
}
