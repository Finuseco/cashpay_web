

import { Suspense } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getDigitalChecksForUser } from '@/lib/actions/check.actions';
import { ChecksClient } from '@/components/checks/checks-client';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { redirect } from 'next/navigation';

async function ChecksContent() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login');
    }
    const checks = await getDigitalChecksForUser(user.id);

    return <ChecksClient user={user} initialChecks={checks} />;
}


export default function ChecksPage() {
  return (
    <DashboardLayout pageTitleKey="pageTitleChecks">
        <Suspense fallback={<div>Chargement des chèques...</div>}>
            <ChecksContent />
        </Suspense>
    </DashboardLayout>
  );
}
