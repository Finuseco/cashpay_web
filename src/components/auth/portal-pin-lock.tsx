
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';
import { PinLockForm } from './pin-lock-form';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { SplashLogo } from '../splash-logo';
import { OnChatLogo } from '../feedback/on-chat-logo';
import { JojoLogo } from '../shopping/jojo-logo';

interface PortalPinLockProps {
    portalName: string;
    children: React.ReactNode;
}

const PIN_LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const PortalLogo = ({ portalName }: { portalName: string }) => {
    if (portalName === 'OnChat') {
        return <OnChatLogo />;
    }
    if (portalName === 'Shopping') {
        return <JojoLogo />;
    }
    return <SplashLogo />;
};

export function PortalPinLock({ portalName, children }: PortalPinLockProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLocked, setIsLocked] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndLockState = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            
            if (!fetchedUser) {
                router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
                return;
            }
            setUser(fetchedUser);

            const lockInfoRaw = sessionStorage.getItem(`${portalName}-lock`);
            if (lockInfoRaw) {
                try {
                    const lockInfo = JSON.parse(lockInfoRaw);
                    const timeSinceUnlock = Date.now() - lockInfo.timestamp;

                    if (timeSinceUnlock < PIN_LOCK_TIMEOUT_MS) {
                        setIsLocked(false);
                    }
                } catch (e) {
                    console.error("Failed to parse lock info from sessionStorage", e);
                }
            }
            setIsLoading(false);
        };
        checkAuthAndLockState();
    }, [portalName, pathname, router]);

    const handleUnlockSuccess = () => {
        try {
            const lockInfo = { unlocked: true, timestamp: Date.now() };
            sessionStorage.setItem(`${portalName}-lock`, JSON.stringify(lockInfo));
            setIsLocked(false);
        } catch (e) {
            console.error("Failed to set lock info in sessionStorage", e);
            // Even if sessionStorage fails, unlock for the current session
            setIsLocked(false);
        }
    };

    if (isLoading || !user) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-zinc-900 text-white">
                <PortalLogo portalName={portalName} />
                <Loader2 className="mt-8 h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (isLocked) {
        return (
            <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
                 <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-[#000e38] to-[#223a7a] rounded-b-[3rem] md:rounded-b-[4rem]" />
                 <div className="w-full max-w-md z-10 my-auto">
                    <PinLockForm user={user} onSuccess={handleUnlockSuccess} portalLogo={<PortalLogo portalName={portalName} />} />
                 </div>
            </main>
        );
    }

    return <>{children}</>;
}
