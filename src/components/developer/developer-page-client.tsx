
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { downloadBinAttributeFile } from '@/services/visa';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

export function DeveloperPageClient() {
    const [isDownloading, setIsDownloading] = useState(false);
    const { openAlert } = useAlertDialog();

    const handleDownload = async () => {
        setIsDownloading(true);
        const result = await downloadBinAttributeFile();
        if (result.success) {
            openAlert({
                title: 'Téléchargement Initié',
                description: `${result.message} Le fichier se trouve à l'emplacement suivant sur le serveur : ${result.filePath}`,
                variant: 'success',
            });
        } else {
            openAlert({
                title: 'Erreur',
                description: result.error,
                variant: 'error',
            });
        }
        setIsDownloading(false);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Outils Développeur & Admin</h1>
            
            <Card>
                <CardHeader>
                    <CardTitle>Synchronisation des Données</CardTitle>
                    <CardDescription>
                        Téléchargez les fichiers de données les plus récents depuis nos partenaires.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-semibold">Fichier des attributs BIN Visa</p>
                            <p className="text-sm text-muted-foreground">Récupère la liste complète des BINs et de leurs attributs.</p>
                        </div>
                        <Button onClick={handleDownload} disabled={isDownloading}>
                            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                            Lancer le téléchargement
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Other developer tools can be added here */}
        </div>
    );
}
