import type { Metadata } from 'next';
import { PortalPinLock } from '@/components/auth/portal-pin-lock';

export const metadata: Metadata = {
  title: 'OnChat - CashPay',
  description: 'Communiquez, partagez et transférez de l\'argent, le tout en un seul endroit.',
};

export default function OnChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PortalPinLock portalName="OnChat">
        {/* onchat-theme applique les variables CSS du thème violet/cyan sur tout /feedback */}
        <div className="onchat-theme onchat-bg h-[100dvh] w-screen overflow-hidden">
            {children}
        </div>
    </PortalPinLock>
  );
}
