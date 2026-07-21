
'use client';

import { useState, useEffect } from "react";
import Link from 'next/link';
import { useTranslation } from "react-i18next";
import { MoreHorizontal, UserPlus, Trash2, ToggleLeft, ToggleRight, KeyRound, Store, Eye, Shield } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DialogTrigger,
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
import { AddSellerForm } from "./add-seller-form";
import type { Seller, Boutique, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sendWorkerPinBySms } from "@/lib/actions/auth.actions";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { addOrUpdateSeller, deleteSeller } from "@/lib/actions/agent.actions";


export function SellersClient({ initialSellers, boutiques }: { initialSellers: Seller[], boutiques: Boutique[] }) {
  const { t } = useTranslation();
  const { openAlert } = useAlertDialog();
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [agent, setAgent] = useState<User | null>(null);

  useEffect(() => {
    setSellers(initialSellers);
  }, [initialSellers]);

  useEffect(() => {
    const fetchAgent = async () => {
      const fetchedAgent = await getAuthenticatedUser();
      setAgent(fetchedAgent);
    };
    fetchAgent();
  }, []);
  
  const boutiqueMap = new Map(boutiques.map(b => [b.id, b.name]));

  const handleAddSeller = async (newSellerData: Omit<Seller, 'createdAt' | 'totalSales'>) => {
    if (!agent) return;
    
    const sellerWithDefaults: Partial<Seller> = {
      ...newSellerData,
      totalSales: 0,
      createdAt: new Date().toISOString(),
    };

    const result = await addOrUpdateSeller(sellerWithDefaults, agent.id);

    if (result.success && result.seller) {
      await sendWorkerPinBySms(result.seller.phone);
      setSellers(prev => [...prev, result.seller!]);
      setIsAddDialogOpen(false);
      openAlert({
        variant: 'success',
        title: t('addSellerSuccessTitle'),
        description: t('addSellerSuccessDescription', { name: result.seller.fullName, phone: result.seller.phone }),
      });
    } else {
        openAlert({ variant: 'error', title: t('addSellerErrorTitle'), description: result.error || t('addSellerErrorDescription') });
    }
  };

  const toggleSellerStatus = (sellerId: number) => {
    // This should ideally be a server action call
    setSellers(sellers.map(s => 
      s.id === sellerId 
        ? { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' }
        : s
    ));
  };
  
  const handleResetPin = async (seller: Seller) => {
    openAlert({
      variant: 'info',
      title: t('resetPinConfirmTitle'),
      description: t('resetPinConfirmDescription', { name: seller.fullName, phone: seller.phone }),
      onClose: async (confirmed) => {
        if (!confirmed) return;
        await sendWorkerPinBySms(seller.phone);
        openAlert({ variant: 'success', title: t('resetPinSuccessTitle'), description: t('resetPinSuccessDescription', { name: seller.fullName }) });
      }
    });
  }
  
  const handleDeleteSeller = (sellerId: number) => {
    if(!agent) return;
    openAlert({
        variant: 'warning',
        title: t('deleteSellerConfirmTitle'),
        description: t('deleteSellerConfirmDescription'),
        onClose: async (confirmed) => { 
            if (!confirmed) return;
            const result = await deleteSeller(sellerId, agent.id);
            if (result.success) {
                setSellers(prev => prev.filter(s => s.id !== sellerId));
                openAlert({ variant: 'success', title: t('deleteSellerSuccessTitle'), description: t('deleteSellerSuccessDescription') });
            } else {
                 openAlert({ variant: 'error', title: t('deleteSellerErrorTitle'), description: result.error || 'Impossible de supprimer le travailleur.' });
            }
        }
    })
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold text-foreground">{t('manageSellersTitle')}</h1>
            <p className="text-muted-foreground">{t('manageSellersDescription')}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('addSellerButton')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addSellerDialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('addSellerDialogDescription')}
              </DialogDescription>
            </DialogHeader>
            <AddSellerForm onFormSubmit={handleAddSeller} boutiques={boutiques} />
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>{t('sellersListTitle')}</CardTitle>
          <CardDescription>{t('sellersListDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tableHeaderWorker')}</TableHead>
                <TableHead>{t('tableHeaderRole')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('tableHeaderBoutique')}</TableHead>
                <TableHead className="text-center">{t('tableHeaderStatus')}</TableHead>
                <TableHead className="text-right">{t('tableHeaderTotalSales')}</TableHead>
                <TableHead>
                  <span className="sr-only">{t('tableHeaderActions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller) => (
                <TableRow key={seller.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={seller.profile_photo || undefined} alt={seller.fullName} data-ai-hint="person portrait" />
                            <AvatarFallback>{seller.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium">{seller.fullName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{seller.id_wallet}</p>
                        </div>
                    </div>
                  </TableCell>
                   <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
                        <Shield className="h-3 w-3" />
                        {t(`role${seller.role}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        <span>{boutiqueMap.get(seller.boutiqueId) || t('unassigned')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={seller.status === 'Active' ? 'default' : 'secondary'} className={cn(seller.status === 'Active' ? 'bg-green-500' : 'bg-zinc-500')}>
                      {t(`status${seller.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{seller.totalSales ? seller.totalSales.toLocaleString() : '0'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button asChild variant="ghost" size="icon">
                          <Link href={`/agent/sellers/${seller.id}`} title={t('viewDetails')}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">{t('viewDetails')}</span>
                          </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">{t('toggleMenu')}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t('tableHeaderActions')}</DropdownMenuLabel>
                           <DropdownMenuItem onClick={() => handleResetPin(seller)}>
                             <KeyRound className="mr-2 h-4 w-4" /> {t('resetPin')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleSellerStatus(seller.id)}>
                            {seller.status === 'Active' ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
                            {seller.status === 'Active' ? t('deactivate') : t('activate')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDeleteSeller(seller.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
