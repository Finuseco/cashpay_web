
'use client';

import { AgentWithdrawClient } from "@/components/agent/withdraw-client";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect }from "react";

function AgentWithdrawLoading() {
    return (
        <div className="w-full max-w-lg mx-auto">
            <Skeleton className="h-[450px] w-full" />
        </div>
    )
}

export default function AgentWithdrawPage() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
             <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Retrait Client</h1>
                <p className="text-muted-foreground mb-8">Permet à un client de retirer des fonds via un agent.</p>
                <AgentWithdrawLoading />
            </div>
        )
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Retrait Client</h1>
            <p className="text-muted-foreground mb-8">Permet à un client de retirer des fonds via un agent.</p>
            <AgentWithdrawClient />
        </div>
    );
}
