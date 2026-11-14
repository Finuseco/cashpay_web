"use client";

import { useTranslation } from "react-i18next";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Globe } from "lucide-react";
import { useState, useEffect } from "react";

const languageMap: { [key: string]: { flag: string; name: string } } = {
  fr: { flag: "fr", name: "Français" },
  en: { flag: "gb", name: "English" },
  es: { flag: "es", name: "Español" },
  pt: { flag: "pt", name: "Português" },
  it: { flag: "it", name: "Italiano" },
  sw: { flag: "tz", name: "Kiswahili" },
  ln: { flag: "cd", name: "Lingala" },
  ru: { flag: "ru", name: "Русский" },
  zh: { flag: "cn", name: "中文" },
  hi: { flag: "in", name: "हिन्दी" },
  ar: { flag: "eg", name: "العربية" },
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguageCode = (i18n.language || "en").split("-")[0];
  const currentLanguage = languageMap[currentLanguageCode] || languageMap.en;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
          <Globe className="h-5 w-5" />
          <span>{currentLanguageCode.toUpperCase()}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Langue / Language</DialogTitle>
        </DialogHeader>
        <RadioGroup
          value={currentLanguageCode}
          onValueChange={changeLanguage}
          className="max-h-[60dvh] overflow-y-auto"
        >
          {Object.entries(languageMap).map(([code, lang]) => (
            <label
              key={code}
              className="flex gap-3 items-center border rounded-lg p-3"
            >
              <RadioGroupItem value={code} />
              <span>{lang.name}</span>
            </label>
          ))}
        </RadioGroup>
      </DialogContent>
    </Dialog>
  );
}
