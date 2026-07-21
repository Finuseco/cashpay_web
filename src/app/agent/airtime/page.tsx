
import { AgentAirtimeClient } from "@/components/agent/airtime-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

export default async function AgentAirtimePage() {
    const agent = await getAuthenticatedUser();
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Vente de Crédit Téléphonique</h1>
            <p className="text-muted-foreground mb-8">Permet à l'agent de vendre du crédit au nom d'un client.</p>
            <AgentAirtimeClient agent={agent} />
        </div>
    );
}
