"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "officehub:theme";

interface Ctx {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<Ctx | null>(null);

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useTheme must be inside <ThemeProvider>");
  return c;
}

function apply(t: Theme): "light" | "dark" {
  const root = document.documentElement;
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const resolved: "light" | "dark" = t === "system" ? (systemDark ? "dark" : "light") : t;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setThemeState(saved);
    setResolved(apply(saved));
    // React to system changes when in "system" mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((localStorage.getItem(STORAGE_KEY) as Theme | null) === "system" || !localStorage.getItem(STORAGE_KEY)) {
        setResolved(apply("system"));
      }
    };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
    setResolved(apply(t));
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
