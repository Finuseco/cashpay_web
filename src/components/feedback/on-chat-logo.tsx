
import { cn } from "@/lib/utils";
import Image from "next/image";

export function OnChatLogo({ className }: { className?: string }) {
  return (
    <Image 
        src="/logos/onchat.png"
        alt="OnChat Logo"
        width={120}
        height={40}
        className={cn("w-28 h-auto", className)}
    />
  );
}
