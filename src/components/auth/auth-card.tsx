

'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from '@/components/logo';

interface AuthCardProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

export function AuthCard({ title, description, children }: AuthCardProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 font-body">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center space-y-4">
                    <Logo className="mx-auto" />
                    <div className="space-y-1">
                        <CardTitle className="text-xl">{title}</CardTitle>
                        <CardDescription>
                            {description}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    {children}
                </CardContent>
            </Card>
        </div>
    );
}
