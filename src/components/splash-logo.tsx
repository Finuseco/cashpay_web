
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function SplashLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", className)}>
      <Image
        src="/logos/logo.png"
        alt=""
        width={180}
        height={48}
        className="w-48 h-auto mb-4"
        priority
      />
      <p className="text-sm font-light text-white/80 tracking-widest mt-2">
        INTEGRATED WITH FINUSECO
      </p>
    </div>
  );
}
