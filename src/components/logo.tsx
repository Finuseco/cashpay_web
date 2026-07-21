
import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo({
  className,
  variant, // variant is no longer used but kept for prop compatibility
  collapsed,
}: {
  className?: string;
  variant?: "white";
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <Image
        src="/logos/favicon.png"
        alt="CashPay Favicon"
        width={10}
        height={10}
        className={cn("h-2.5 w-2.5 transition-all duration-300", className)}
      />
    );
  }

  return (
    <Image
      src="/logos/logo.png"
      alt="CashPay Logo"
      width={130} 
      height={35} 
      className={cn("h-10 w-auto", className)} 
      priority
    />
  );
}
