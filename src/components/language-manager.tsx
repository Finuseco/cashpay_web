
"use client";

import { useTranslation } from "react-i18next";
import { useEffect } from "react";

export function LanguageManager() {
  const { i18n } = useTranslation();

  useEffect(() => {
    // This effect runs only on the client side, after the component has mounted.
    // This prevents the server from trying to access `document`.
    if (typeof window !== "undefined") {
      document.documentElement.lang = i18n.language;
    }
  }, [i18n.language]);

  return null;
}
