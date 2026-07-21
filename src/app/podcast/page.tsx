

'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getGoogleOauthUrl, uploadFileToDrive } from '@/services/google';
import type { User } from '@/lib/types';
import { Loader2, Radio, Link as LinkIcon, UploadCloud, Podcast, FileAudio } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import Image from 'next/image';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

function PodcastPageClient({ user, initialIsLinked }: { user: User, initialIsLinked: boolean }) {
    const [isLinked, setIsLinked] = useState(initialIsLinked);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { openAlert } = useAlertDialog();

    const handleLinkGoogleDrive = async () => {
        setIsLoading(true);
        const googleUrl = await getGoogleOauthUrl('drive');
        window.location.href = googleUrl;
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('audio/')) {
            setSelectedFile(file);
        } else {
            openAlert({ title: 'Fichier Invalide', description: 'Veuillez sélectionner un fichier audio.', variant: 'error' });
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        const result = await uploadFileToDrive(selectedFile);
        setIsUploading(false);

        if (result.success) {
            openAlert({
                title: 'Téléversement Réussi',
                description: `Le fichier "${selectedFile.name}" a été envoyé sur votre Google Drive.`,
                variant: 'success'
            });
            setSelectedFile(null);
        } else {
             openAlert({ title: 'Erreur de Téléversement', description: result.error, variant: 'error' });
        }
    };
    
    return (
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto space-y-8">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center bg-primary/10 text-primary rounded-full p-3 mb-4">
                            <Radio className="h-10 w-10"/>
                        </div>
                        <h1 className="text-4xl font-bold text-foreground tracking-tight">TurnNET Radio</h1>
                        <p className="mt-2 text-lg text-muted-foreground">Créez et hébergez vos podcasts en toute simplicité.</p>
                    </div>

                    {!isLinked ? (
                         <Card className="text-center">
                             <CardHeader>
                                 <CardTitle>Connectez votre Google Drive</CardTitle>
                                 <CardDescription>Pour commencer, liez votre compte Google Drive pour stocker vos fichiers audio en toute sécurité.</CardDescription>
                             </CardHeader>
                             <CardContent>
                                 <Image src="/images/google-drive.png" alt="Google Drive" width={100} height={100} className="mx-auto" data-ai-hint="google drive logo" />
                             </CardContent>
                             <CardFooter>
                                 <Button onClick={handleLinkGoogleDrive} disabled={isLoading} className="w-full">
                                     {isLoading ? <Loader2 className="animate-spin mr-2"/> : <LinkIcon className="mr-2"/>}
                                     Connecter Google Drive
                                 </Button>
                             </CardFooter>
                         </Card>
                    ) : (
                        <Card>
                             <CardHeader>
                                <CardTitle>Nouveau Podcast</CardTitle>
                                <CardDescription>Téléversez votre fichier audio pour créer un nouvel épisode.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {selectedFile ? (
                                    <div className="p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center gap-3">
                                        <FileAudio className="h-10 w-10 text-primary" />
                                        <p className="font-semibold">{selectedFile.name}</p>
                                        <p className="text-sm text-muted-foreground">Taille: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                        <Button onClick={handleUpload} disabled={isUploading} className="w-full">
                                            {isUploading ? <Loader2 className="animate-spin mr-2"/> : <UploadCloud className="mr-2"/>}
                                            Téléverser et Publier
                                        </Button>
                                    </div>
                                ) : (
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary transition-colors"
                                    >
                                        <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                                        <p className="mb-2 font-semibold">Glissez-déposez votre fichier ici</p>
                                        <p className="text-sm text-muted-foreground mb-4">ou</p>
                                        <Button variant="outline">Sélectionner un fichier audio</Button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden"/>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
    );
}


export default function PodcastPage() {
    const [user, setUser] = useState<User | null>(null);
    const [isLinked, setIsLinked] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkUserAndDriveStatus = async () => {
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            if (fetchedUser) {
                // In a real app, you would check if a Drive token exists for this user in the DB
                const driveTokenExists = localStorage.getItem('gdrive_token_linked') === 'true';
                setIsLinked(driveTokenExists);
            }
            setIsLoading(false);
        };
        checkUserAndDriveStatus();
    }, []);

    return (
        <DashboardLayout pageTitleKey="pageTitlePodcast">
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : user ? (
                <PodcastPageClient user={user} initialIsLinked={isLinked} />
            ) : null}
        </DashboardLayout>
    );
}
