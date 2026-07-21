

"use client";

import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Laptop } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageSwitcher } from "../ui/language-switcher";

function AppearanceSettingsLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="mt-8 pt-6 border-t">
          <Skeleton className="h-5 w-1/4 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
        <div className="mt-8 pt-6 border-t">
          <Skeleton className="h-5 w-1/4 mb-4" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <AppearanceSettingsLoading />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('appearanceTitle')}</CardTitle>
        <CardDescription>
          {t('appearanceDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={theme}
          onValueChange={setTheme}
          className="grid gap-6"
        >
          <Label className="flex items-center justify-between rounded-lg border p-4 cursor-pointer [&:has([data-state=checked])]:border-primary">
            <span className="flex items-center gap-3">
              <Sun className="h-5 w-5" />
              <span className="font-semibold">{t('appearanceThemeLight')}</span>
            </span>
            <RadioGroupItem value="light" id="light" />
          </Label>
          <Label className="flex items-center justify-between rounded-lg border p-4 cursor-pointer [&:has([data-state=checked])]:border-primary">
            <span className="flex items-center gap-3">
              <Moon className="h-5 w-5" />
              <span className="font-semibold">{t('appearanceThemeDark')}</span>
            </span>
            <RadioGroupItem value="dark" id="dark" />
          </Label>
          <Label className="flex items-center justify-between rounded-lg border p-4 cursor-pointer [&:has([data-state=checked])]:border-primary">
            <span className="flex items-center gap-3">
              <Laptop className="h-5 w-5" />
              <span className="font-semibold">{t('appearanceThemeSystem')}</span>
            </span>
            <RadioGroupItem value="system" id="system" />
          </Label>
        </RadioGroup>

        <div className="mt-8 pt-6 border-t">
          <Label className="text-base font-semibold">{t('appearanceLanguageLabel')}</Label>
          <p className="text-sm text-muted-foreground mb-4">{t('appearanceLanguageDescription')}</p>
          <LanguageSwitcher />
        </div>

        <div className="mt-8 pt-6 border-t">
          <Label className="text-base font-semibold">{t('appearanceViewModeLabel', 'View Mode')}</Label>
          <p className="text-sm text-muted-foreground mb-4">{t('appearanceViewModeDescription', 'Force mobile or desktop view (for testing purposes). Auto is recommended.')}</p>
          <RadioGroup
            defaultValue="auto"
            className="grid grid-cols-3 gap-4"
          >
            <Label className="flex items-center justify-between rounded-lg border p-4 cursor-pointer [&:has([data-state=checked])]:border-primary">
              <span className="font-semibold">{t('appearanceViewModeAuto', 'Auto')}</span>
              <RadioGroupItem value="auto" id="auto" />
            </Label>
            <Label className="flex items-center justify-between rounded-lg border p-4 cursor-pointer [&:has([data-state=checked])]:border-primary">
              <span className="font-semibold">{t('appearanceViewModeMobile', 'Mobile')}</span>
              <RadioGroupItem value="mobile" id="mobile" />
            </Label>
            <Label className="flex items-center justify-between rounded-lg border p-4 cursor-pointer [&:has([data-state=checked])]:border-primary">
              <span className="font-semibold">{t('appearanceViewModeDesktop', 'Desktop')}</span>
              <RadioGroupItem value="desktop" id="desktop" />
            </Label>
          </RadioGroup>
        </div>

      </CardContent>
    </Card>
  );
}
