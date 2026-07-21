import { PosClient } from "@/components/agent/pos-client";
import { getAgentProducts } from '@/lib/actions/agent.actions';
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import type { Product, ProductCategory } from '@/lib/types';

export default async function AgentSellPage() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return <div>Veuillez vous connecter pour accéder au POS.</div>;
    }

    const products: Product[] = await getAgentProducts(user.id);
    
    // Categories are not in DB, so we keep them static for now
    const categories: ProductCategory[] = [
        { id: 'cat-alim', name: 'Alimentaire', domain: 'Alimentation' },
        { id: 'cat-hab', name: 'Habillement', domain: 'Habillement' },
        { id: 'cat-elec', name: 'Électronique', domain: 'Électronique' },
        { id: 'cat-quin', name: 'Quincaillerie', domain: 'Quincaillerie' },
    ];

    return (
        <PosClient initialProducts={products} categories={categories} agent={user} />
    );
}
