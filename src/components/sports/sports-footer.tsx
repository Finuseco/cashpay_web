
'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Home, User, PlayCircle, ReceiptText, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBetSlip } from "@/hooks/use-bet-slip";

const NavItem = ({ href, icon: Icon, label, isActive }: { href: string; icon: React.ElementType; label: string; isActive: boolean }) => {
    return (
        <Link
        href={href}
        className={cn(
            "flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors text-zinc-400 hover:text-yellow-400",
            isActive && "text-yellow-400"
        )}
        >
        <Icon className="h-5 w-5 mb-1" />
        <span>{label}</span>
        </Link>
    );
};

export function SportsFooter() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { selections, setOpen } = useBetSlip();

  const navItems = [
    { href: "/casino", icon: Home, label: t('footerHome') },
    { href: "/casino/sports", icon: PlayCircle, label: t('sportsFooterLive') },
    { href: "#", icon: ReceiptText, label: ""}, // Placeholder for the central button
    { href: "/casino/history", icon: History, label: t('sportsFooterMyBets') },
    { href: "/profile", icon: User, label: t('footerProfile') },
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-[#1e293b] border-zinc-700 md:hidden">
      <nav className="flex items-center h-16 justify-around">
        {navItems.map((item, index) => {
          if (index === 2) {
            return (
              <div key="betslip-button" className="w-1/5 flex justify-center">
                <button
                  onClick={() => setOpen(true)}
                  aria-label={t('betSlipTitle')}
                  className="relative flex items-center justify-center h-16 w-16 bg-yellow-400 text-black rounded-full shadow-lg transform -translate-y-6 border-4 border-[#1e2d3b]"
                >
                  <ReceiptText className="h-7 w-7" />
                  {selections.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-yellow-400 text-xs font-bold">
                      {selections.length}
                    </span>
                  )}
                </button>
              </div>
            );
          }
          return (
            <div key={item.href} className="w-1/5">
                <NavItem {...item} isActive={pathname.startsWith(item.href)} />
            </div>
          );
        })}
      </nav>
    </footer>
  );
}
