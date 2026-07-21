'use client';

import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { useState, useEffect } from 'react';

const languageMap: { [key: string]: { flag: string; name: string } } = {
    fr: { flag: 'fr', name: 'Français' },
    en: { flag: 'gb', name: 'English' },
    es: { flag: 'es', name: 'Español' },
    pt: { flag: 'pt', name: 'Português' },
    it: { flag: 'it', name: 'Italiano' },
    sw: { flag: 'tz', name: 'Kiswahili' },
    ln: { flag: 'cd', name: 'Lingala' },
    ru: { flag: 'ru', name: 'Русский' },
    zh: { flag: 'cn', name: '中文' },
    hi: { flag: 'in', name: 'हिन्दी' },
    ar: { flag: 'eg', name: 'العربية' },
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

  const currentLanguageCode = (i18n.language || 'en').split('-')[0];
  const currentLanguage = languageMap[currentLanguageCode] || languageMap.en;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-white hover:bg-white/20">
          {isClient ? (
            <Image
              src={`https://flagcdn.com/w20/${currentLanguage.flag}.png`}
              alt={currentLanguage.name}
              width={20}
              height={15}
            />
          ) : (
            <Globe className="h-5 w-5" />
          )}
           <span className="text-xs font-bold">{currentLanguageCode.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700 text-white">
        {Object.entries(languageMap).map(([code, lang]) => (
           <DropdownMenuItem key={code} onClick={() => changeLanguage(code)} className="focus:bg-zinc-700">
              <Image
                src={`https://flagcdn.com/w20/${lang.flag}.png`}
                alt={lang.name}
                width={20}
                height={15}
                className="mr-2 h-5 w-5 rounded-sm object-cover"
              />
              <span>{lang.name}</span>
           </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}