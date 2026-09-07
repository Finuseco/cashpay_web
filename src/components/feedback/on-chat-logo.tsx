
import { cn } from "@/lib/utils";
import Image from "next/image";

export function OnChatLogo({ className }: { className?: string }) {
  return (
    <Image 
        src="/logos/onchat.png"
        alt=""
        width={30}
        height={12}
        className={cn("w-15 h-auto", className)}
    />
  );
}
