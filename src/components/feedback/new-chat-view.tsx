
'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Form, FormField, FormMessage, FormItem } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User } from '@/lib/types';
import { createConversationByWalletId } from '@/lib/actions/message.actions';
import { InternationalWalletInput } from '../shared/international-wallet-input';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';

interface NewChatViewProps {
    currentUser: User | null;
    onBack: () => void;
    onNewConversation: (user: User) => void;
}

const formSchema = z.object({
    walletId: z.string().min(12, 'L\'ID du portefeuille doit contenir 12 caractères.'),
});

export function NewChatView({ currentUser, onBack, onNewConversation }: NewChatViewProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            walletId: '',
        }
    });

    const handleStartChat = async (values: z.infer<typeof formSchema>) => {
        if (!currentUser) return;
        setIsLoading(true);

        const result = await createConversationByWalletId(currentUser.id, values.walletId);

        setIsLoading(false);

        if (result.success && result.conversation?.contact) {
            onNewConversation(result.conversation.contact);
        } else {
             openAlert({ title: t('startChatErrorTitle'), description: result.error || t('startChatErrorDesc'), variant: 'error' });
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 bg-[#0b141a] text-white">
            <header className="flex items-center p-2 sm:p-3 border-b border-zinc-700/50 shrink-0 bg-[#141C38]">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft />
                </Button>
                <h2 className="font-bold text-base ml-4">{t('newChatTitle')}</h2>
            </header>
            <div className="p-4 space-y-6">
                 <p className="text-sm text-muted-foreground">{t('newChatDescription')}</p>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleStartChat)} className="space-y-6">
                         <FormField
                            control={form.control}
                            name="walletId"
                            render={({ field }) => (
                                <FormItem>
                                    <InternationalWalletInput
                                        field={field}
                                        onVerificationResult={() => {}} // No verification needed here
                                        label={t('transferRecipientWalletLabel')}
                                        placeholder={t('newChatPlaceholder')}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading && <Loader2 className="animate-spin mr-2" />}
                            {t('startChatButton')}
                        </Button>
                    </form>
                </Form>
                 <Button
                    variant="outline"
                    className="w-full bg-transparent border-zinc-700 hover:bg-zinc-800"
                    onClick={() => router.push('/feedback/groups/create')}
                >
                    <Users className="mr-2 h-4 w-4"/> Nouveau Groupe
                </Button>
            </div>
        </div>
    );
}
