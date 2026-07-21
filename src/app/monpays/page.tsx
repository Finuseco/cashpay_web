
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { MonPaysLogo } from '@/components/monpays/monpays-logo';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';

const Splash = ({ onFinished }: { onFinished: () => void }) => {
    const [progress, setProgress] = useState(0);
  
    useEffect(() => {
      const timer = setInterval(() => {
        setProgress(prev => (prev >= 100 ? 100 : prev + 4));
      }, 50);
      return () => clearInterval(timer);
    }, []);
  
    useEffect(() => {
      if (progress >= 100) {
        setTimeout(onFinished, 300);
      }
    }, [progress, onFinished]);
  
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <MonPaysLogo />
        <Progress value={progress} className="w-48 mt-4 h-1 bg-zinc-700 [&>div]:bg-red-600" />
      </div>
    );
  };


export default function MonPaysPage() {
  const router = useRouter();

  useEffect(() => {
    // Directly redirect to dashboard, bypassing the country selection.
    router.replace('/monpays/dashboard');
  }, [router]);

  // Show a loading/splash screen while redirecting
  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-900">
        <Splash onFinished={() => router.replace('/monpays/dashboard')} />
    </div>
  );
}
