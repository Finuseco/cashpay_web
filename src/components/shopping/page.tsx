

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
        <h1 className="text-5xl font-bold text-foreground">JoJo</h1>
        <p className="text-muted-foreground mt-1">shopping online</p>
        <Progress value={progress} className="w-48 mt-4 h-1 bg-muted [&>div]:bg-primary" />
      </div>
    );
  };


export default function ShoppingRootPage() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
      const timer = setTimeout(() => {
          router.push('/shopping/home');
      }, 2500); // Wait for splash animation
      return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Splash onFinished={() => {}} />
    </div>
  );
}
