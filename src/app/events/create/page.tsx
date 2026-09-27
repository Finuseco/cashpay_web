"use client";

import { CreateEventForm } from "@/components/events/create-event-form";

export default function CreateEventPage() {
    return (
        <main className="flex-1 bg-muted/20 px-4 py-6 md:px-6 md:py-8">
            <div className="mx-auto w-full max-w-3xl">
                <CreateEventForm />
            </div>
        </main>
    );
}
