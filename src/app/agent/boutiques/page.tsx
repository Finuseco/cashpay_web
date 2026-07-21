import { BoutiquesClient } from '@/components/agent/boutiques-client';
import { getAgentBoutiques } from '@/lib/actions/agent.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { Boutique } from '@/lib/types';

export default async function AgentBoutiquesPage() {
    const user = await getAuthenticatedUser();

    if (!user) {
        return <div>Veuillez vous connecter pour voir vos boutiques.</div>;
    }

    const boutiques: Boutique[] = await getAgentBoutiques(user.id);

    return (
        <BoutiquesClient initialBoutiques={boutiques} />
    );
}
