
import { cn } from "@/lib/utils";
import Image from "next/image";

export function JojoLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
        <Image 
            src="/logos/jojo.png" 
            alt="JoJo Logo" 
            width={100}
            height={40}
            className="w-24 h-auto"
        />
        <p className="text-muted-foreground text-xs -mt-1">shopping online</p>
    </div>
  );
}
