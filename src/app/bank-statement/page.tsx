

'use client';

import { BankStatementClient } from "@/components/bank-statement/bank-statement-client";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function BankStatementPage() {
    return (
        <DashboardLayout pageTitleKey="pageTitleBankStatement">
            <main className="flex-1 p-4 md:p-8">
                <BankStatementClient />
            </main>
        </DashboardLayout>
    );
}
