
'use client';

import { AgentDepositClient } from "@/components/agent/deposit-client";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";

function AgentDepositLoading() {
    return (
        <div className="w-full max-w-lg mx-auto">
            <Skeleton className="h-[450px] w-full" />
        </div>
    )
}

export default function AgentDepositPage() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
             <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Dépôt Client</h1>
                <p className="text-muted-foreground mb-8">Permet à l'agent de recharger le portefeuille d'un client.</p>
                <AgentDepositLoading />
            </div>
        )
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Dépôt Client</h1>
            <p className="text-muted-foreground mb-8">Permet à l'agent de recharger le portefeuille d'un client.</p>
            <AgentDepositClient />
        </div>
    );
}
