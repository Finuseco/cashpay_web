
import { cn } from "@/lib/utils";
import Image from "next/image";

export function NetOnLogo({ className }: { className?: string }) {
  return (
    <Image 
        src="/logos/neton-n.png" 
        alt="NetOn Logo" 
        width={24}
        height={40}
        className={cn("h-8 w-auto", className)}
    />
  );
}
