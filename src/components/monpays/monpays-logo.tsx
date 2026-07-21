
import { cn } from "@/lib/utils";
import Image from "next/image";

export function MonPaysLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logos/monpays.png"
      alt="MonPays Logo"
      width={160}
      height={40}
      className={cn("w-40 h-auto", className)}
    />
  );
}
