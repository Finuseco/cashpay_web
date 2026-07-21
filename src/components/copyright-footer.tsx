
'use client';

import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./ui/language-switcher";
import { Separator } from "./ui/separator";
import Link from "next/link";

export function CopyrightFooter({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const year = new Date().getFullYear();

  if (!isClient) {
    return (
        <footer className={cn("w-full py-4 bg-background text-center", className)}>
            <Skeleton className="h-5 w-96 mx-auto" />
        </footer>
    );
  }

  return (
    <footer className={cn("w-full py-4 text-center text-xs text-muted-foreground", className)}>
      <p>
        {t('copyrightText', { year: year })} {t('copyrightAllRightsReserved')}
      </p>
    </footer>
  );
}
