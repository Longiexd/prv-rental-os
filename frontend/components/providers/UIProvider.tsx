"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fr } from "@/lib/i18n/fr";

export type KlynxTheme = "dark" | "light";
export type KlynxLocale = "en" | "fr";

type UIContextValue = {
  theme: KlynxTheme;
  locale: KlynxLocale;
  setTheme: (theme: KlynxTheme) => void;
  setLocale: (locale: KlynxLocale) => void;
  t: (english: string) => string;
};

const UIContext = createContext<UIContextValue | null>(null);
const THEME_KEY = "klynx-theme";
const LOCALE_KEY = "klynx-locale";
const originalText = new WeakMap<Text, string>();
const lastRenderedText = new WeakMap<Text, string>();
const originalAttrs = new WeakMap<Element, Map<string, string>>();
const translatableAttrs = ["placeholder", "title", "aria-label"] as const;

const legacyFrenchToEnglish: Record<string, string> = {
  "Disponible": "Available",
  "Réservé": "Reserved",
  "Reserve": "Reserved",
  "Loué": "Rented",
  "Loue": "Rented",
  "Nettoyage": "Cleaning",
  "Indisponible": "Unavailable",
  "Non défini": "Undefined",
  "Nouveau prospect": "New prospect",
  "Contacté": "Contacted",
  "Contacte": "Contacted",
  "Devis envoyé": "Quotation sent",
  "Devis envoye": "Quotation sent",
  "Réservation confirmée": "Booking confirmed",
  "Reservation confirmee": "Booking confirmed",
  "Véhicule remis": "Vehicle delivered",
  "Vehicule remis": "Vehicle delivered",
  "Location terminée": "Rental completed",
  "Location terminee": "Rental completed",
  "Gagné": "Won",
  "Gagne": "Won",
  "Perdu": "Lost",
  "Réparation": "Repair",
  "Reparation": "Repair",
  "Entretien": "Maintenance",
};

const monthFr: Record<string, string> = {
  Jan: "janv.", Feb: "févr.", Mar: "mars", Apr: "avr.", May: "mai", Jun: "juin",
  Jul: "juil.", Aug: "août", Sep: "sept.", Oct: "oct.", Nov: "nov.", Dec: "déc.",
};

function localizeDateFragments(value: string, locale: KlynxLocale) {
  if (locale === "en") return value;
  return value.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (month) => monthFr[month] ?? month);
}

function translateExact(value: string, locale: KlynxLocale) {
  const canonical = legacyFrenchToEnglish[value] ?? value;
  if (locale === "en") return canonical;
  return localizeDateFragments(fr[canonical] ?? canonical, locale);
}

function applyTranslation(root: ParentNode, locale: KlynxLocale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const parent = node.parentElement;
    if (parent && !parent.closest("[data-i18n-ignore]") && !["SCRIPT", "STYLE", "CODE", "PRE"].includes(parent.tagName)) {
      const current = node.nodeValue ?? "";
      if (!originalText.has(node)) {
        originalText.set(node, current);
      } else {
        const lastRendered = lastRenderedText.get(node);
        if (lastRendered !== undefined && current !== lastRendered) {
          // React changed this text after it was first rendered (for example a
          // greeting, async status or error). Treat the new English text as
          // the new canonical source instead of restoring a stale phrase.
          originalText.set(node, current);
        }
      }
      const source = originalText.get(node) ?? "";
      const leading = source.match(/^\s*/)?.[0] ?? "";
      const trailing = source.match(/\s*$/)?.[0] ?? "";
      const core = source.trim();
      if (core) {
        const translated = `${leading}${translateExact(core, locale)}${trailing}`;
        lastRenderedText.set(node, translated);
        if (node.nodeValue !== translated) node.nodeValue = translated;
      }
    }
    node = walker.nextNode() as Text | null;
  }

  const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
  for (const element of elements) {
    if (element.closest("[data-i18n-ignore]")) continue;
    let attrs = originalAttrs.get(element);
    if (!attrs) {
      attrs = new Map<string, string>();
      originalAttrs.set(element, attrs);
    }
    for (const attr of translatableAttrs) {
      const current = element.getAttribute(attr);
      if (current !== null && !attrs.has(attr)) attrs.set(attr, current);
      const source = attrs.get(attr);
      if (source !== undefined) element.setAttribute(attr, translateExact(source, locale));
    }
  }
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<KlynxTheme>("dark");
  const [locale, setLocaleState] = useState<KlynxLocale>("en");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    const storedLocale = window.localStorage.getItem(LOCALE_KEY);
    const nextTheme: KlynxTheme = storedTheme === "light" ? "light" : "dark";
    const nextLocale: KlynxLocale = storedLocale === "fr" ? "fr" : "en";
    setThemeState(nextTheme);
    setLocaleState(nextLocale);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.lang = nextLocale;
  }, []);

  const setTheme = useCallback((nextTheme: KlynxTheme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  const setLocale = useCallback((nextLocale: KlynxLocale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(LOCALE_KEY, nextLocale);
    document.documentElement.lang = nextLocale;
  }, []);

  const t = useCallback((english: string) => translateExact(english, locale), [locale]);

  useEffect(() => {
    applyTranslation(document.body, locale);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const text = mutation.target as Text;
          const parent = text.parentElement;
          if (parent) applyTranslation(parent, locale);
          continue;
        }
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType === Node.TEXT_NODE) {
            const text = addedNode as Text;
            const parent = text.parentElement;
            if (parent) applyTranslation(parent, locale);
          } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
            applyTranslation(addedNode as Element, locale);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo(() => ({ theme, locale, setTheme, setLocale, t }), [theme, locale, setTheme, setLocale, t]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useKlynxUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useKlynxUI must be used within UIProvider");
  return context;
}
