
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { DownloadCloud } from 'lucide-react';

export default function DownloadsPage() {
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-white mb-6">Téléchargements</h1>
             <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Contenu hors ligne</CardTitle>
                    <CardDescription>Vos films et séries téléchargés apparaîtront ici.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center text-zinc-400 min-h-[50vh]">
                    <DownloadCloud className="h-16 w-16 mb-4" />
                    <p>Aucun téléchargement pour le moment.</p>
                </CardContent>
            </Card>
        </div>
    );
}
