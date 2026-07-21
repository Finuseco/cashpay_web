import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Importations des fichiers de traduction principaux
import translationEN from './locales/en/translation.json';
import translationFR from './locales/fr/translation.json';
import translationES from './locales/es/translation.json';
import translationPT from './locales/pt/translation.json';
import translationRU from './locales/ru/translation.json';
import translationZH from './locales/zh/translation.json';
import translationHI from './locales/hi/translation.json';
import translationSW from './locales/sw/translation.json';
import translationLN from './locales/ln/translation.json';
import translationAR from './locales/ar/translation.json';
import translationIT from './locales/it/translation.json';
import mlmTranslations from './locales/MLM.json';

const resources = {
  en: { translation: translationEN, MLM: mlmTranslations.en },
  fr: { translation: translationFR, MLM: mlmTranslations.fr },
  es: { translation: translationES, MLM: mlmTranslations.es },
  pt: { translation: translationPT, MLM: mlmTranslations.pt },
  it: { translation: translationIT, MLM: mlmTranslations.it },
  ru: { translation: translationRU, MLM: mlmTranslations.ru },
  zh: { translation: translationZH, MLM: mlmTranslations.zh },
  hi: { translation: translationHI, MLM: mlmTranslations.hi },
  sw: { translation: translationSW, MLM: mlmTranslations.sw },
  ln: { translation: translationLN, MLM: mlmTranslations.ln },
  ar: { translation: translationAR, MLM: mlmTranslations.ar },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    ns: ['translation', 'MLM'],
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false, 
    },
    detection: {
      order: ['cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['cookie'],
    },
  });

export default i18n;
