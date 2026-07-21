
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdCampaign } from "@/lib/types";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MoreVertical, Eye, BarChart2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const statusStyles: Record<AdCampaign['status'], string> = {
    pending_approval: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
    approved: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    rejected: 'bg-red-500/20 text-red-500 border-red-500/30',
    active: 'bg-green-500/20 text-green-500 border-green-500/30',
    completed: 'bg-zinc-500/20 text-zinc-500 border-zinc-500/30',
    paused: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
};

const statusTranslations: Record<AdCampaign['status'], string> = {
    pending_approval: 'En attente',
    approved: 'Approuvée',
    rejected: 'Rejetée',
    active: 'Active',
    completed: 'Terminée',
    paused: 'En pause',
};


export function AdsCampaignTable({ campaigns }: { campaigns: AdCampaign[] }) {
    if (campaigns.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                <p>Vous n'avez encore créé aucune campagne.</p>
                <p className="text-sm">Cliquez sur "Créer une Campagne" pour commencer.</p>
            </div>
        );
    }
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Créée le</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>${campaign.budget.toFixed(2)}</TableCell>
                        <TableCell>{campaign.durationDays} jours</TableCell>
                        <TableCell>{format(new Date(campaign.createdAt), 'd MMM yyyy', { locale: fr })}</TableCell>
                        <TableCell>
                            <Badge className={cn(statusStyles[campaign.status])}>
                                {statusTranslations[campaign.status]}
                            </Badge>
                        </TableCell>
                         <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> Voir l'aperçu</DropdownMenuItem>
                                    <DropdownMenuItem><BarChart2 className="mr-2 h-4 w-4" /> Voir les stats</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                         </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
