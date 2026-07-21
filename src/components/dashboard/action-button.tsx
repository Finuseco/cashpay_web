
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ActionButton({ label, icon: Icon, href, className }: { label: string, icon: React.FC<LucideProps>, href: string, className?: string }) {
    return (
        <Link href={href} className="flex flex-col items-center gap-2">
            <Button variant="outline" className={cn("h-14 w-14 rounded-2xl bg-primary/10 border-0 shadow-sm text-primary", className)}>
                <Icon className="h-7 w-7" />
            </Button>
            <span className="text-xs font-medium text-foreground">{label}</span>
        </Link>
    );
}
