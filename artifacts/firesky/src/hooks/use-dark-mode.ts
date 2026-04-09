import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "firesky-dark-mode";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === "true";
    } catch {}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    applyTheme(isDark);
    try {
      localStorage.setItem(STORAGE_KEY, String(isDark));
    } catch {}
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((v) => !v), []);

  return { isDark, toggle };
}

export function initDarkMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const dark =
      stored !== null
        ? stored === "true"
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    applyTheme(dark);
  } catch {}
}
