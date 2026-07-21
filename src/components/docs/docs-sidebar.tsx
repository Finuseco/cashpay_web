
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, BookOpen, CreditCard, Layers, Briefcase, DollarSign, Webhook, KeyRound, Cog, ShoppingCart, Send, Megaphone, Users, Pin, Banknote } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Logo } from "../logo";

const mainNav = [
    { href: "/docs", label: "Introduction" },
    { href: "/docs/authentication", label: "Authentification" },
    { href: "/docs/webhooks", label: "Webhooks" },
];

const paymentsNav = [
    { href: "/docs/payments", label: "Aperçu des Paiements" },
    { href: "/app/docs/b2b-wallet-transfer-api-specs.md", label: "Transferts B2B (OTP)" },
    { href: "/app/docs/b2b-collection-api-specs.md", label: "Collecte par Carte" },
];

const payoutsNav = [
    { href: "/docs/payouts", label: "Aperçu des Payouts" },
    { href: "/app/docs/intl-bank-transfer-api-specs.md", label: "Virements SWIFT/Inter" },
];

const issuingNav = [
    { href: "/app/docs/cards-api-specs.md", label: "Aperçu de l'Issuing JIT" },
    { href: "/docs/issuing/cardholders", label: "Titulaires" },
    { href: "/docs/issuing/cards", label: "Cartes" },
    { href: "/docs/issuing/authorizations", label: "Autorisations" },
    { href: "/docs/issuing/transactions", label: "Transactions" },
];

const servicesNav = [
    { href: "/app/docs/airtime-api-specs.md", label: "API Airtime" },
    { href: "/app/docs/internal-billing-api-specs.md", label: "API Facturation Privée" },
];

const adminNav = [
    { href: "/app/docs/fees-api-specs.md", label: "Moteur de Frais" },
    { href: "/app/docs/hardware-keys-api-specs.md", label: "Clés Matérielles HSM" },
];


export function DocsSidebar() {
    const pathname = usePathname();

    const NavGroup = ({ title, links }: { title: string, links: {href: string, label: string}[] }) => (
        <div className="space-y-1">
            <h4 className="px-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">{title}</h4>
            {links.map(link => (
                <Link 
                    key={link.href}
                    href={link.href}
                    className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        pathname === link.href 
                        ? "bg-zinc-700 text-white" 
                        : "text-zinc-300 hover:bg-zinc-700/50"
                    )}
                >
                    {link.label}
                </Link>
            ))}
        </div>
    );

    return (
        <aside className="hidden md:flex w-64 flex-col border-r border-zinc-800">
             <div className="p-4 border-b border-zinc-800">
                <Link href="/dashboard" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4"/>
                    Retour au Tableau de Bord
                </Link>
            </div>
            <ScrollArea className="flex-1">
                <nav className="p-4 space-y-6">
                    <NavGroup title="Commencer" links={mainNav} />
                    <NavGroup title="Paiements & B2B" links={paymentsNav} />
                    <NavGroup title="Décaissements" links={payoutsNav} />
                    <NavGroup title="Issuing (Cartes JIT)" links={issuingNav} />
                    <NavGroup title="Services" links={servicesNav} />
                    <NavGroup title="Souveraineté & Frais" links={adminNav} />
                </nav>
            </ScrollArea>
        </aside>
    );
}
