'use client';

import { CreateGroupForm } from '@/components/feedback/groups/create-group-form';
import { Suspense } from 'react';

export default function CreateGroupPage() {
    return (
        <Suspense>
            <CreateGroupForm />
        </Suspense>
    );
}
