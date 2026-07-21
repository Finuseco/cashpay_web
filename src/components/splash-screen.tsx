
'use client';

import { useEffect, useState } from 'react';
import { SplashLogo } from '@/components/splash-logo';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';

const backgroundImages = [
    '/images/image1.jpg',
    '/images/image2.jpg',
    '/images/image3.jpg',
    '/images/image4.jpg',
];

export function SplashScreen() {
  const [progress, setProgress] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    setBgIndex(Math.floor(Math.random() * backgroundImages.length));
    
    const timer = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 4));
    }, 50); 

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="relative flex flex-col items-center justify-center h-full min-h-screen text-white p-8 overflow-hidden">
        <Image
            src={backgroundImages[bgIndex]}
            alt="CashPay background"
            fill
            className="z-0 object-cover"
        />
        <div className="absolute inset-0 bg-black/50 z-10"></div>
      
      <div className="z-20 flex flex-col items-center justify-center flex-1">
        <SplashLogo />
      </div>
      <div className="z-20 w-full max-w-sm space-y-4">
        <Progress value={progress} className="w-full h-1 bg-white/20 [&>div]:bg-primary" />
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-white/70">Powered by</span>
          <Image src="/logos/finuseco.png" alt="Finuseco Logo" width={80} height={20} className="h-5 w-auto" />
        </div>
      </div>
    </main>
  );
}
