
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { JojoLogo } from '@/components/shopping/jojo-logo';

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
        <JojoLogo />
        <Progress value={progress} className="w-48 mt-4 h-1 bg-muted [&>div]:bg-primary" />
      </div>
    );
  };


export default function ShoppingRootPage() {
  const router = useRouter();

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Splash onFinished={() => router.push('/shopping/home')} />
    </div>
  );
}
