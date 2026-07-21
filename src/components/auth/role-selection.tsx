
'use client';

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Briefcase } from "lucide-react";
import { SplashLogo } from "../splash-logo";
import { useTranslation } from "react-i18next";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { Button } from "../ui/button";

const RoleCard = ({ href, icon: Icon, title, description }: { href: string; icon: React.ElementType, title: string, description: string }) => (
    <Link href={href} className="block w-full">
        <Card className="text-center hover:bg-white/10 hover:shadow-xl transition-all duration-200 cursor-pointer h-full p-4 bg-white/5 border border-white/20 backdrop-blur-lg">
            <CardHeader className="items-center p-0">
                <Icon className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-white">{title}</CardTitle>
                <CardDescription className="mt-1 text-white/80 text-xs">{description}</CardDescription>
            </CardHeader>
        </Card>
    </Link>
)

export function RoleSelection() {
    return (
        <div className="flex flex-col items-center gap-8 text-center">
            <SplashLogo />
            <div className="w-full max-w-lg grid grid-cols-1 md:grid-cols-2 gap-6">
                <RoleCard 
                    href="/login"
                    icon={User}
                    title="Espace Client"
                    description="Accédez à votre portefeuille personnel."
                />
                <RoleCard 
                    href="/agent/login"
                    icon={Briefcase}
                    title="Espace Agent"
                    description="Gérez votre activité et vos vendeurs."
                />
            </div>
        </div>
    );
}
