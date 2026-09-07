
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Loader2, RefreshCw } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function AiAssistantSettings({ user }: { user: User | null }) {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState("Bonjour, je suis actuellement occupé. Je vous recontacte dès que possible.");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsClient(true);
        if (user?.assistantSettings) {
            setEnabled(user.assistantSettings.isEnabled);
            setMessage(user.assistantSettings.customMessage);
        }
    }, [user]);

    const handleSave = () => {
        setIsLoading(true);
        
        // Simulation de mise à jour locale
        const profile = localStorage.getItem('cashpay-user-profile');
        if (profile) {
            const data = JSON.parse(profile);
            data.assistantSettings = { isEnabled: enabled, customMessage: message, activeDays: ["Lundi","Mardi","Mercredi","Jeudi","Vendredi"] };
            localStorage.setItem('cashpay-user-profile', JSON.stringify(data));
        }
        
        setTimeout(() => {
            setIsLoading(false);
            toast({ title: 'Assistant Configuré', description: 'Votre répondeur automatique est à jour.', variant: 'success' });
        }, 600);
    };

    if (!isClient) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50">
                <div className="space-y-0.5">
                    <Label className="font-bold text-sm">Répondeur OnChat</Label>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">Réponse automatique par IA</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className={cn("space-y-3 transition-all duration-300", !enabled && "opacity-30 pointer-events-none")}>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Message d'absence personnalisé</Label>
                <Textarea 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)}
                    className="bg-white border-zinc-200 resize-none text-sm h-28 rounded-xl focus-visible:ring-primary/10"
                    placeholder="Ex: Je suis en réunion, je reviens vers vous..."
                />
            </div>

            <Button onClick={handleSave} className="w-full h-12 font-black uppercase text-xs tracking-widest shadow-md" variant="gradient" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>}
                SAUVEGARDER
            </Button>
        </div>
    );
}
