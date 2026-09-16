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

const I18nContext = createContext({ lang: "en", setLang: () => {}, t: (s) => s, fmtDate: (v) => new Date(v).toLocaleDateString(), fmtDateTime: (v) => new Date(v).toLocaleString() });

// Mirror of the committed language for non-component helpers (module-scope
// date formatters such as the reports tables) that can't call useLang().
// Overwritten during render so it always reflects the language the tree is
// drawing.
let currentLang = "en";
export function getCurrentLang() {
  return currentLang;
}

// Dates follow the app language, not the OS/browser locale — so a school that
// switched the UI to Arabic sees Arabic calendar text everywhere. `opts`
// matches Intl.DateTimeFormat options (pass e.g. { timeZone: "UTC" } to keep
// stored day-granularity dates from shifting).
export function fmtDate(value, opts) {
  try {
    return new Intl.DateTimeFormat(getCurrentLang() || "en", opts || { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleDateString("en-US", opts || { month: "short", day: "numeric" });
  }
}
export function fmtDateTime(value) {
  try {
    return new Intl.DateTimeFormat(getCurrentLang() || "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang);
  currentLang = lang; // sync the module mirror before children render

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

  const value = useMemo(() => ({ lang, setLang, t, fmtDate, fmtDateTime }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLang() {
  return useContext(I18nContext);
}