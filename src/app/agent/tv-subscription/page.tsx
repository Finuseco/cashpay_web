
import { AgentTvSubscriptionClient } from "@/components/agent/tv-subscription-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

export default async function AgentTvSubscriptionPage() {
    const agent = await getAuthenticatedUser();
    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Réabonnement TV</h1>
            <p className="text-muted-foreground mb-8">Permet de vendre ou renouveler des abonnements TV pour les clients.</p>
            <AgentTvSubscriptionClient agent={agent} />
        </div>
    );
}
