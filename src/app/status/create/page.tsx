
'use client';

import { useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { X, Type, Send, Video, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createStatus } from '@/lib/actions/status.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

const colorPalette = ['#3498db', '#9b59b6', '#e74c3c', '#2ecc71', '#f1c40f', '#1abc9c', '#34495e'];

export default function CreateStatusPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    
    const initialType = searchParams.get('type') === 'text' ? 'text' : 'media';
    const [statusType, setStatusType] = useState<'text' | 'media'>(initialType);
    
    const [textContent, setTextContent] = useState('');
    const [backgroundColor, setBackgroundColor] = useState(colorPalette[0]);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setMediaFile(file);
            setMediaPreview(URL.createObjectURL(file));
        }
    };

    const handlePostStatus = async () => {
        const user = await getAuthenticatedUser();
        if (!user) {
            router.push('/login');
            return;
        }

        let result;
        if (statusType === 'text') {
            if (!textContent.trim()) return;
            result = await createStatus({
                userId: user.id,
                type: 'text',
                content: textContent,
                backgroundColor: backgroundColor
            });
        } else {
            if (!mediaFile) return;
            const reader = new FileReader();
            reader.readAsDataURL(mediaFile);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const mediaType = mediaFile.type.startsWith('video') ? 'video' : 'image';
                const postResult = await createStatus({
                    userId: user.id,
                    type: mediaType,
                    content: base64data,
                });
                 if (postResult.success) {
                    router.back();
                } else {
                    openAlert({ title: "Erreur", description: postResult.error, variant: 'error' });
                }
            };
            return;
        }

        if (result.success) {
            router.back();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    const renderContent = () => {
        if (statusType === 'text') {
            return (
                <div className="h-full flex flex-col items-center justify-center p-8 transition-colors" style={{ backgroundColor }}>
                    <Textarea 
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        placeholder="Écrivez quelque chose..."
                        className="bg-transparent border-none text-white text-3xl font-bold text-center resize-none shadow-none focus-visible:ring-0 h-auto"
                    />
                </div>
            );
        }

        if (statusType === 'media') {
            return (
                <div className="h-full flex items-center justify-center bg-black">
                    {mediaPreview ? (
                        <Image src={mediaPreview} alt="Aperçu" className="max-h-full max-w-full" />
                    ) : (
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                            Sélectionner une photo ou vidéo
                        </Button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
                </div>
            );
        }
        return null;
    };

    return (
        <div className="absolute inset-0 z-50 bg-black flex flex-col text-white">
            <header className="p-4 flex justify-between items-center bg-black/30 z-10">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><X /></Button>
                {statusType === 'text' && (
                    <div className="flex gap-2">
                        {colorPalette.map(color => (
                            <button key={color} style={{ backgroundColor: color }} className="h-8 w-8 rounded-full border-2 border-white" onClick={() => setBackgroundColor(color)} />
                        ))}
                    </div>
                )}
            </header>

            <main className="flex-1 relative">
                {renderContent()}
            </main>

            <footer className="p-4 flex justify-between items-center bg-black/30 z-10">
                 <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setStatusType('text')} className={cn(statusType === 'text' && 'bg-white/20')}><Type /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setStatusType('media')} className={cn(statusType === 'media' && 'bg-white/20')}><ImageIcon /></Button>
                </div>
                <Button className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600" onClick={handlePostStatus}>
                    <Send />
                </Button>
            </footer>
        </div>
    );
}
