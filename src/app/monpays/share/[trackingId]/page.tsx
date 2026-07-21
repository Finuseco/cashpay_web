
import { recordShareClick } from '@/lib/actions/monpays.actions';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default async function ShareRedirectPage({ params }: { params: { trackingId: string } }) {
    const headerList = headers();
    const ip = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    const userAgent = headerList.get('user-agent') ?? 'Unknown';

    // 1. Enregistrer le clic et traiter le paiement potentiel
    const result = await recordShareClick(params.trackingId, ip, userAgent);

    // 2. Rediriger vers la publication originale
    if (result.success && result.targetPostId) {
        redirect(`/monpays/platform/${result.targetPostId}`);
    } else {
        redirect('/monpays/dashboard');
    }

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-900 text-white">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="animate-pulse">Redirection vers MonPays...</p>
        </div>
    );
}
