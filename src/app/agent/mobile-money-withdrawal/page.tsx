

import { MobileMoneyWithdrawalClient } from "@/components/agent/mobile-money-withdrawal-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";

export default async function MobileMoneyWithdrawalPage() {
    const agent = await getAuthenticatedUser();
    const currencies = agent ? await getUserCurrencies(agent.id) : [];
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Retrait Mobile Money</h1>
            <p className="text-muted-foreground mb-8">Permet à un client sans compte CashPay de retirer du cash en utilisant son portefeuille Mobile Money.</p>
            <MobileMoneyWithdrawalClient agent={agent} agentCurrencies={currencies} />
        </div>
    );
}
