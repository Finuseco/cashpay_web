
'use client';

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { CreateEventForm } from "@/components/events/create-event-form";
import { useTranslation } from 'react-i18next';

export default function CreateEventPage() {
    const { t } = useTranslation();
    return (
        <DashboardLayout pageTitleKey="pageTitleCreateEvent">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto">
                    <CreateEventForm />
                </div>
            </main>
        </DashboardLayout>
    );
}
