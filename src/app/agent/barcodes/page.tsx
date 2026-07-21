import { BarcodeSheet } from '@/components/agent/barcode-sheet';
import { getAgentProducts } from '@/lib/actions/agent.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { redirect } from 'next/navigation';

export default async function AgentBarcodesPage() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/agent/login');
    }
    const products = await getAgentProducts(user.id);
    return <BarcodeSheet products={products} />;
}
