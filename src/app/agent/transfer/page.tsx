
import { AgentTransferClient } from "@/components/agent/transfer-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";

export default async function AgentTransferPage() {
    const agent = await getAuthenticatedUser();
    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Transfert Compte à Compte</h1>
            <p className="text-muted-foreground mb-8">Effectuez un transfert sécurisé vers un autre portefeuille CashPay.</p>
            <AgentTransferClient agent={agent} />
        </div>
    );
}
