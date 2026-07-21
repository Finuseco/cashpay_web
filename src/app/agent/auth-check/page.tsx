
'use client';

import { PinLockForm } from "@/components/auth/pin-lock-form";
import { Suspense } from 'react';
import type { User } from '@/lib/types';
import { useEffect, useState } from "react";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function AuthCheckLoading() {
  return (
    <main className="flex h-full min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-[#000e38] to-[#223a7a]">
      <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    </main>
  );
}


function AgentAuthCheckPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const fetchedUser = await getAuthenticatedUser();
            if (fetchedUser) {
                setUser(fetchedUser);
            } else {
                router.replace('/agent/login');
            }
            setIsLoading(false);
        };
        fetchUser();
    }, [router]);

    if (isLoading || !user) {
        return <AuthCheckLoading />;
    }

    return (
        <main className="flex h-full min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-[#000e38] to-[#223a7a]">
            <div className="w-full max-w-md">
                <PinLockForm user={user} isAgentFlow={true} />
            </div>
        </main>
    );
}

export default function AgentAuthCheck() {
    return (
        <Suspense fallback={<AuthCheckLoading />}>
            <AgentAuthCheckPage />
        </Suspense>
    );
}
