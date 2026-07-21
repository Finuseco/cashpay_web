
'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { MoreHorizontal, PlusCircle, Trash2, Edit, Printer, Book, Package, Megaphone, Store } from "lucide-react";
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { AddEditProductForm } from "@/components/agent/add-edit-product-form";
import { AddEditBookForm } from "@/components/agent/add-edit-book-form";
import type { Product, ProductCategory, Boutique } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { addOrUpdateProduct, deleteProduct } from "@/lib/actions/agent.actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


// --- Composant principal ---
export function ProductManagementClient({ initialProducts, categories, boutiques }: { initialProducts: Product[], categories: ProductCategory[], boutiques: Boutique[] }) {
  const { openAlert } = useAlertDialog();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeFormType, setActiveFormType] = useState<'product' | 'book'>('product');
  
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const handleFormSubmit = async (productData: Partial<Product>) => {
    const user = await getAuthenticatedUser();
    if (!user) {
        openAlert({ variant: 'error', title: 'Erreur', description: 'Agent non authentifié.' });
        return;
    }
    const result = await addOrUpdateProduct(productData, user.id);

    if (result.success && result.product) {
      if (editingProduct) {
        setProducts(products.map(p => p.id === result.product!.id ? result.product! : p));
        openAlert({ variant: 'success', title: 'Produit mis à jour', description: `Le produit "${result.product.name}" a été mis à jour.`});
      } else {
        setProducts(prev => [...prev, result.product!]);
        openAlert({ variant: 'success', title: 'Produit ajouté', description: `Le produit "${result.product.name}" a été ajouté à votre stock.`});
      }
      setIsFormOpen(false);
      setEditingProduct(null);
    } else {
       openAlert({ variant: 'error', title: 'Erreur', description: result.error || "Impossible d'enregistrer le produit." });
    }
  };

  const handleEdit = (product: Product) => {
    setActiveFormType(product.categoryId === 'cat-livre' ? 'book' : 'product');
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleDelete = async (product: Product) => {
    const user = await getAuthenticatedUser();
    if (!user) return;
    
    openAlert({
      variant: 'warning',
      title: 'Êtes-vous sûr ?',
      description: `Cette action est irréversible. Si du stock reste (${product.stock}), sa valeur sera enregistrée comme une perte dans vos rapports.`,
      onClose: async (confirmed?: boolean) => {
        if (!confirmed) return; 

        // Loss recording is now handled ATOMICALLY inside the server action
        const result = await deleteProduct(product.id, user.id);
        if (result.success) {
            setProducts(products.filter(p => p.id !== product.id));
            openAlert({ variant: 'success', title: 'Produit Supprimé', description: "Le produit a été retiré de votre inventaire." });
        } else {
             openAlert({ variant: 'error', title: 'Erreur de suppression', description: result.error || "Impossible de supprimer le produit." });
        }
      }
    });
  };

  const openAddForm = (type: 'product' | 'book') => {
    setActiveFormType(type);
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des Produits & Stock</h1>
          <p className="text-muted-foreground">Ajoutez, modifiez et suivez le stock de vos produits.</p>
        </div>
        {boutiques.length > 0 && (
          <div className="flex gap-2">
              <Button asChild variant="outline">
                  <Link href="/agent/barcodes">
                      <Printer className="mr-2 h-4 w-4" /> Imprimer les Codes-Barres
                  </Link>
              </Button>
              <Button onClick={() => openAddForm('product')}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Ajouter un produit
              </Button>
          </div>
        )}
      </div>
      
      {boutiques.length === 0 ? (
        <Card>
          <CardContent className="py-20 flex flex-col items-center justify-center text-center">
            <Store className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">Créez votre première boutique</h3>
            <p className="text-muted-foreground mt-2 mb-6 max-w-sm">
              Pour ajouter des produits, vous devez d'abord enregistrer au moins une boutique ou un point de vente.
            </p>
            <Button asChild>
              <Link href="/agent/boutiques">
                <PlusCircle className="mr-2 h-4 w-4" /> Gérer mes boutiques
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Liste des Produits</CardTitle>
            <CardDescription>La liste de tous les produits de votre boutique.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Boutique</TableHead>
                  <TableHead className="text-right">Prix de Vente (USD)</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className={cn(product.stock === 0 ? "bg-destructive/10" : product.stock > 0 && product.stock <= 5 ? "bg-yellow-400/10" : "")}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Image src={product.images ? product.images[0] : 'https://placehold.co/100x100.png'} alt={product.name} width={40} height={40} className="rounded-md object-cover bg-muted" data-ai-hint="product image" />
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{product.barcode}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                       <Badge variant="outline">{product.boutiqueName || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">${product.sellingPrice.toFixed(2)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", product.stock === 0 ? "text-destructive" : product.stock > 0 && product.stock <= 5 ? "text-yellow-500" : "")}>{product.stock}</TableCell>
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
                          <DropdownMenuItem onClick={() => handleEdit(product)}>
                            <Edit className="mr-2 h-4 w-4" /> Modifier
                          </DropdownMenuItem>
                           <DropdownMenuItem asChild>
                             <Link href={`/marketing/ads?productId=${product.id}`}>
                                <Megaphone className="mr-2 h-4 w-4" /> Promouvoir
                             </Link>
                           </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDelete(product)}>
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
      )}

       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <Tabs value={activeFormType} onValueChange={(value) => setActiveFormType(value as 'product' | 'book')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="product"><Package className="mr-2 h-4 w-4"/>Produit Standard</TabsTrigger>
                        <TabsTrigger value="book"><Book className="mr-2 h-4 w-4"/>Livre</TabsTrigger>
                    </TabsList>
                </Tabs>
                <DialogTitle className="pt-4">
                    {editingProduct 
                        ? (activeFormType === 'book' ? 'Modifier le livre' : 'Modifier le produit')
                        : (activeFormType === 'book' ? 'Ajouter un nouveau livre' : 'Ajouter un nouveau produit')
                    }
                </DialogTitle>
                <DialogDescription>
                    Remplissez les informations ci-dessous.
                </DialogDescription>
            </DialogHeader>
            {activeFormType === 'product' ? (
                <AddEditProductForm 
                    onFormSubmit={handleFormSubmit} 
                    categories={categories}
                    boutiques={boutiques}
                    initialData={editingProduct} 
                />
            ) : (
                <AddEditBookForm 
                    onFormSubmit={handleFormSubmit}
                    boutiques={boutiques}
                    initialData={editingProduct}
                />
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
