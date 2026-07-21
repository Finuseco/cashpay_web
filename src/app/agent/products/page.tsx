import { ProductManagementClient } from '@/components/agent/product-management-client';
import type { Product, ProductCategory, Boutique } from '@/lib/types';
import { getAgentProducts, getAgentBoutiques } from '@/lib/actions/agent.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export default async function AgentProductsPage() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return <div>Veuillez vous connecter pour voir vos produits.</div>;
    }
    
    const [products, boutiques] = await Promise.all([
        getAgentProducts(user.id),
        getAgentBoutiques(user.id),
    ]);
    
    // Categories are now expanded
    const categories: ProductCategory[] = [
        { id: 'cat-hab', name: 'Habillement', domain: 'Habillement' },
        { id: 'cat-elec', name: 'Électronique', domain: 'Électronique' },
        { id: 'cat-alim', name: 'Alimentaire', domain: 'Alimentation' },
        { id: 'cat-cosm', name: 'Cosmétiques', domain: 'Beauté' },
        { id: 'cat-quin', name: 'Quincaillerie', domain: 'Quincaillerie' },
        { id: 'cat-autre', name: 'Autre', domain: 'Autre' },
    ];

    return (
        <ProductManagementClient initialProducts={products} categories={categories} boutiques={boutiques} />
    );
}
