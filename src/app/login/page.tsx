'use client';

import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { Ticket, Briefcase } from "lucide-react";
import type { LucideProps } from "lucide-react";
import Image from "next/image";

const APK_DOWNLOAD_URL =
  "https://drive.google.com/file/d/13Ucg3V8TUELPb4oyZtcbt8I4WpaqDwDh/view?usp=drivesdk";

const ConnectivityLink = ({
  href,
  icon: Icon,
  imgSrc,
  label,
}: {
  href: string;
  icon?: React.FC<LucideProps>;
  imgSrc?: string;
  label: string;
}) => (
  <Link
    href={href}
    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors text-center"
  >
    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary border border-white/20">
      {Icon && <Icon className="h-5 w-5" />}
      {imgSrc && (
        <Image src={imgSrc} alt={label} width={24} height={24} />
      )}
    </div>
    <span className="text-xs font-medium">{label}</span>
  </Link>
);

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
      <div
        className="absolute top-0 left-0 right-0 h-1/2
        bg-gradient-to-br from-[#ff6600] to-orange-500
        rounded-b-[3rem] md:rounded-b-[4rem]"
      />

      <div className="w-full max-w-md z-10 my-auto">
        <LoginForm />
      </div>

      <footer className="w-full max-w-md z-10 mt-auto py-4">
        <div className="text-center mb-2">
          <h2 className="font-semibold text-white/90 text-sm">
            Découvrez notre centre de connectivité
          </h2>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          <ConnectivityLink
            href="/login?returnTo=%2Fmonpays"
            imgSrc="/logos/monpays1.png"
            label="MonPays"
          />

          <ConnectivityLink
            href="/login?returnTo=%2Fshopping"
            imgSrc="/logos/jojo1.png"
            label="Shopping"
          />

          <ConnectivityLink
            href="/login?returnTo=%2Ffeedback"
            imgSrc="/logos/onchat.png"
            label="OnChat"
          />

          <ConnectivityLink
            href="/login?returnTo=%2Fevents"
            icon={Ticket}
            label="Événements"
          />

          <ConnectivityLink
            href="/agent/login"
            icon={Briefcase}
            label="Espace Agent"
          />
        </div>

        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 p-1.5 max-w-full overflow-hidden">

            <a
              href={APK_DOWNLOAD_URL}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-black/80 px-3 py-2 text-white/90 text-xs font-medium border border-white/20 hover:bg-black hover:text-white transition-colors"
              aria-label="Installer l’application CashPay All"
            >
              <span
                className="flex items-center justify-center h-6 w-6 rounded-md bg-white"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    fill="#34A853"
                    d="M3.6 2.8c-.4.4-.6 1-.6 1.7v15c0 .7.2 1.3.6 1.7L13 12 3.6 2.8Z"
                  />
                  <path
                    fill="#FBBC04"
                    d="m13 12 3-3 4.8 2.7c.8.4.8 1.5 0 1.9L16 16l-3-4Z"
                  />
                  <path
                    fill="#4285F4"
                    d="M3.6 2.8 13 12l3-3L5.3 2.1c-.6-.3-1.2-.1-1.7.7Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M13 12 3.6 21.2c.5.8 1.2 1 1.8.7L16 15l-3-3Z"
                  />
                </svg>
              </span>

              <span>Installer l’application</span>
            </a>

            <a
              href="https://drive.google.com/file/d/1UjnHM-JDpq1vPIWwutVxMaQzhA83YUyU/view?usp=drivesdk"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-black/80 px-3 py-2 text-white/90 text-xs font-medium border border-white/20 hover:bg-black hover:text-white transition-colors"
              aria-label="USSD call CP install"
            >
              <span
                className="flex items-center justify-center h-6 w-6 rounded-md bg-white text-black font-bold text-[8px] leading-none"
                aria-hidden="true"
              >
                USSD
              </span>

              <span>USSD call CP install</span>
            </a>

          </div>
        </div>

        <Separator className="my-4 bg-white/20" />

        <div className="text-center text-xs text-white/70 w-full">
          <p>
            {t("copyrightText", { year: new Date().getFullYear() })}{" "}
            {t("copyrightAllRightsReserved")}
          </p>

          <div className="mt-2 flex gap-4 justify-center items-center">
            <Link
              href="#"
              className="hover:text-white"
            >
              {t("loginTermsAndConditions", "Terms & Conditions")}
            </Link>

            <Separator
              orientation="vertical"
              className="h-4 bg-white/50"
            />

            <a
              href="https://developer.cashpay-all.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              {t("loginDevelopers", "Developers")}
            </a>

            <Separator
              orientation="vertical"
              className="h-4 bg-white/50"
            />

            <LanguageSwitcher />
          </div>
        </div>
      </footer>
    </main>
  );
}
