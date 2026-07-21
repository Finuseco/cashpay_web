
'use client';

import { OnChatLoginForm } from "@/components/feedback/onchat-login-form";

export default function OnChatLoginPage() {
    return (
        <main className="flex h-full min-h-screen flex-col items-center justify-center p-8 bg-zinc-900">
            <div className="w-full max-w-md">
                <OnChatLoginForm />
            </div>
        </main>
    );
}
