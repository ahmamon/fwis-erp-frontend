import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ar } from "./i18n/ar.js";
import { fr } from "./i18n/fr.js";

// Supported languages. English is the source of truth: English UI strings are
// the dictionary keys, so "en" needs no dictionary object — `t(s)` returns the
// translation for ar/fr or the English key itself, so missing keys degrade to
// English instead of rendering blank.
export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "fr", label: "Français" },
];

const LS_KEY = "fwis_lang";
const DICTS = { ar, fr };

function readStoredLang() {
  try {
    const stored = localStorage.getItem(LS_KEY);
    return LANGUAGES.some((l) => l.value === stored) ? stored : "en";
  } catch {
    return "en"; // storage unavailable (private mode etc.) — default to English
  }
}

const I18nContext = createContext({ lang: "en", setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang);

  // Mirror the chosen language into <html lang/dir> on mount and on change:
  // Arabic flips the whole document to RTL; screen readers get the right lang.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang === "ar" ? "ar" : lang === "fr" ? "fr" : "en";
    root.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (value) => {
    if (!LANGUAGES.some((l) => l.value === value)) return;
    setLangState(value);
    try {
      localStorage.setItem(LS_KEY, value);
    } catch {
      // storage unavailable — the choice just won't persist across reloads
    }
  };

  const t = (key) => (DICTS[lang] && DICTS[lang][key]) || key;

  const value = useMemo(() => ({ lang, setLang, t }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLang() {
  return useContext(I18nContext);
}