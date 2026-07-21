import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MonPays Vidéos - CashPay',
  description: 'Vidéos courtes et divertissantes sur MonPays.',
};

export default function MonPaysVideoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This layout overrides the parent layout to provide a full-screen experience
  return <>{children}</>;
}
