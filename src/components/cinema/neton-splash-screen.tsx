
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { NetOnLogo } from './neton-logo';

export function NetOnSplashScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 1;
      });
    }, 20); // Faster splash screen

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress === 100) {
      setTimeout(() => {
        router.push('/cinema');
      }, 300); // Short delay after loading bar completes
    }
  }, [progress, router]);

  return (
    <main className="flex flex-col items-center justify-center h-full min-h-screen bg-black text-white p-8">
      <div className="flex flex-col items-center justify-center flex-1">
        <NetOnLogo className="text-5xl" />
      </div>
      <div className="w-full max-w-xs space-y-4">
        <Progress value={progress} className="w-full h-1 bg-zinc-800 [&>div]:bg-red-600" />
      </div>
    </main>
  );
}
