
'use client';

import { useState, useEffect } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCountryProducts, toggleProductStatus } from '@/lib/actions/super-agent/staff.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Ban, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function SuperAgentProducts() {
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [superAgent, setSuperAgent] = useState<any>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();

    const fetchProducts = async () => {
        setIsLoading(true);
        const current = await getAuthenticatedUser();
        setSuperAgent(current);
        if (current?.country) {
            const data = await getCountryProducts(current.country);
            setProducts(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleToggleStatus = async (product: any) => {
        if (!superAgent) return;

        const actionText = product.isPublic ? 'BLOQUER' : 'ACTIVER';
        
        openAlert({
            title: `${actionText} le produit ?`,
            description: `Voulez-vous vraiment ${actionText.toLowerCase()} le produit "${product.name}" sur le marché national ?`,
            variant: product.isPublic ? "destructive" : "default",
            showCancel: true,
            onClose: async (confirmed) => {
                if (confirmed) {
                    setProcessingId(product.id);
                    const result = await toggleProductStatus(product.id, product.isPublic, superAgent.id);
                    setProcessingId(null);

                    if (result.success) {
                        toast({ title: result.isPublic ? "Produit activé" : "Produit bloqué", variant: "success" });
                        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isPublic: result.isPublic } : p));
                    } else {
                        openAlert({ title: "Erreur", description: result.error, variant: 'error' });
                    }
                }
            }
        });
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Modération JoJo Market</h1>
            
            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Catalogue National</CardTitle>
                    <CardDescription className="text-zinc-400">Supervisez les produits publiés par les agents et vendeurs de votre pays.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700 hover:bg-transparent">
                                <TableHead className="text-zinc-400">Produit</TableHead>
                                <TableHead className="text-zinc-400">Boutique / Vendeur</TableHead>
                                <TableHead className="text-zinc-400">Prix</TableHead>
                                <TableHead className="text-zinc-400">Stock</TableHead>
                                <TableHead className="text-right text-zinc-400">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : products.length > 0 ? products.map(product => (
                                <TableRow key={product.id} className={cn("border-zinc-700 hover:bg-zinc-700/30 transition-colors", !product.isPublic && "opacity-60 bg-red-900/5")}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-10 w-10 shrink-0 bg-zinc-700 rounded overflow-hidden">
                                                <Image 
                                                    src={product.image} 
                                                    alt={product.name} 
                                                    fill 
                                                    className="object-cover" 
                                                />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{product.name}</p>
                                                {!product.isPublic && <p className="text-[10px] text-red-400 font-bold uppercase">Banni / Masqué</p>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm font-medium">{product.boutiqueName}</p>
                                        <p className="text-[10px] text-zinc-400">Vendu par {product.seller?.name}</p>
                                    </TableCell>
                                    <TableCell className="font-bold text-primary">${product.sellingPrice.toFixed(2)}</TableCell>
                                    <TableCell>{product.stock}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" asChild className="text-zinc-400 hover:text-white">
                                                <Link href={`/shopping/${product.id}`} target="_blank"><Eye className="h-4 w-4"/></Link>
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className={cn(product.isPublic ? "text-red-400 hover:bg-red-400/10" : "text-green-400 hover:bg-green-400/10")}
                                                onClick={() => handleToggleStatus(product)}
                                                disabled={processingId === product.id}
                                            >
                                                {processingId === product.id ? <Loader2 className="h-4 w-4 animate-spin"/> : product.isPublic ? <Ban className="h-4 w-4"/> : <CheckCircle2 className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={5} className="text-center py-10 text-zinc-500">Aucun produit publié dans votre pays.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
