
'use client';

import Image from "next/image";
import type { TvChannel } from "@/lib/types";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTranslation } from "react-i18next";
import { PlayCircle } from "lucide-react";

export function LiveTvClient({ channels }: { channels: TvChannel[] }) {
    const { openAlert } = useAlertDialog();
    const { t } = useTranslation();

    const handlePlay = (channelName: string) => {
        openAlert({
            variant: 'info',
            title: t('subscriptionRequiredTitle', 'Abonnement Requis'),
            description: t('liveTvSubscriptionDescription', `Pour regarder ${channelName}, un abonnement premium est nécessaire.`),
        });
    };

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-white mb-6">TV en Direct</h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {channels.map((channel) => (
                    <div key={channel.id} className="group relative rounded-lg overflow-hidden cursor-pointer bg-zinc-800 aspect-video flex items-center justify-center p-4" onClick={() => handlePlay(channel.name)}>
                        <Image src={channel.logoUrl} alt={channel.name} width={150} height={80} className="object-contain" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <PlayCircle className="h-12 w-12 text-white" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
