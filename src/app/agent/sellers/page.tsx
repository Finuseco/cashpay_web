import { SellersClient } from '@/components/agent/sellers-client';
import { getAgentSellers, getAgentBoutiques } from '@/lib/actions/agent.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { Seller, Boutique } from '@/lib/types';

export default async function AgentSellersPage() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return <div>Veuillez vous connecter pour voir les vendeurs.</div>;
    }

    const [sellers, boutiques] = await Promise.all([
        getAgentSellers(user.id),
        getAgentBoutiques(user.id),
    ]);
    
    return (
        <SellersClient initialSellers={sellers} boutiques={boutiques} />
    );
}
