
import type {Metadata} from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import { PushNotificationHandler } from '@/components/push-notification-handler';


export const metadata: Metadata = {
  title: 'CashPay',
  description: 'Your digital financial services solution.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logos/favicon.png" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF6600" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <Providers>
          <PageLoader />
          <PushNotificationHandler />
          {children}
        </Providers>
      </body>
    </html>
  );
}
