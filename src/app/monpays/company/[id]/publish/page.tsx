'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, Loader2, ArrowLeft } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Image from 'next/image';
import { createMonPaysActivity } from '@/lib/actions/monpays.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export default function PublishPage() {
    const router = useRouter();
    const params = useParams();
    const companyId = parseInt(params.id as string, 10);
    const [content, setContent] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { openAlert } = useAlertDialog();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(URL.createObjectURL(file));
                setImageDataUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        const user = await getAuthenticatedUser();
        if (!user) {
            router.push('/login');
            return;
        }

        if (!content && !imageDataUrl) {
            openAlert({ title: 'Contenu manquant', description: 'Veuillez écrire un message ou ajouter une image.', variant: 'warning'});
            return;
        }

        setIsSubmitting(true);
        const result = await createMonPaysActivity(companyId, user.id, content, imageDataUrl);
        setIsSubmitting(false);

        if (result.success) {
            openAlert({
                title: 'Publication Réussie',
                description: 'Votre contenu a été publié avec succès.',
                variant: 'success'
            });
            router.push('/monpays/dashboard');
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error'});
        }
    };


    return (
        <div className="bg-zinc-900 min-h-screen text-white p-4">
             <header className="flex items-center mb-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-xl font-bold ml-2">Créer une Publication</h1>
            </header>
            <Card className="bg-zinc-800 border-zinc-700">
                <CardContent className="pt-6 space-y-4">
                    <Textarea 
                        placeholder="Quoi de neuf ?"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="bg-transparent border-zinc-600 min-h-[120px] text-base"
                    />

                    {imagePreview && (
                        <div className="relative aspect-video w-full">
                            <Image src={imagePreview} alt="Aperçu" fill className="rounded-lg object-cover" />
                        </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                            <UploadCloud className="text-zinc-400" />
                        </Button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Publier
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
