import { AgentLoginForm } from "@/components/auth/agent-login-form";

export default function AgentLoginPage() {
    return (
        <main className="flex h-full min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-[#000e38] to-[#223a7a]">
            <div className="w-full max-w-md">
                <AgentLoginForm />
            </div>
        </main>
    );
}
