import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPaymentDetails } from '@/lib/actions/payment.actions';
import { getPaymentLinkById } from '@/lib/actions/payment-link.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { GatewayPaymentContent } from '@/components/gateway/gateway-payment-content';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

function LoadingSkeleton() {
    return (
        <main className="flex min-h-screen items-center justify-center p-4 bg-zinc-50">
            <Card className="w-full max-w-md p-6 space-y-6">
                <div className="flex flex-col items-center gap-4">
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </Card>
        </main>
    );
}

async function PaymentGatewayLoader({ paymentId }: { paymentId: string }) {
    const user = await getAuthenticatedUser();
    
    // Check if it's a Payment Link ID (starts with l_)
    if (paymentId.startsWith('l_')) {
        const linkId = parseInt(paymentId.replace('l_', ''), 10);
        const link = await getPaymentLinkById(linkId);

        if (!link || link.status !== 'active') {
            notFound();
        }

        const details = {
            amount: link.amount || 0,
            currency: link.currency,
            description: link.description,
            merchantName: (link as any).ownerName,
            status: 'pending',
            isPaymentLink: true,
            isFixed: link.isFixed,
            projectImage: link.imageUrl,
            category: link.category,
            ownerWalletId: (link as any).ownerWalletId
        };

        return (
            <GatewayPaymentContent 
                initialDetails={details as any} 
                paymentId={0} // Not a standard merchant payment yet
                paymentLinkId={link.id}
                currentUser={user}
            />
        );
    }

    // Standard Merchant Payment
    const id = parseInt(paymentId, 10);
    if (isNaN(id)) notFound();

    const detailsResult = await getPaymentDetails(id);
    if (!detailsResult.success || !detailsResult.data) {
        notFound();
    }

    return (
        <GatewayPaymentContent 
            initialDetails={detailsResult.data} 
            paymentId={id} 
            currentUser={user}
        />
    );
}

export default function GatewayPage({ params }: { params: { paymentId: string } }) {
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <PaymentGatewayLoader paymentId={params.paymentId} />
        </Suspense>
    );
}
