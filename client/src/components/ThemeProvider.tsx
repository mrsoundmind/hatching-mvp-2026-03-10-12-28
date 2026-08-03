import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Light mode disabled for now — force dark mode until light theme is fully polished.
// Exported so UI can HIDE the theme toggle rather than render a dead control (#114).
export const FORCE_DARK_MODE = true;

function getInitialTheme(): Theme {
  if (FORCE_DARK_MODE) return "dark";
  const stored = localStorage.getItem("hatchin-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((newTheme: Theme) => {
    if (FORCE_DARK_MODE) return; // light mode disabled
    setThemeState(newTheme);
    localStorage.setItem("hatchin-theme", newTheme);
    applyTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    if (FORCE_DARK_MODE) return; // light mode disabled
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    // While dark is forced, always apply dark regardless of the state value — this
    // self-heals any session that got stuck on "light" (e.g. from the old OS-change bug).
    applyTheme(FORCE_DARK_MODE ? "dark" : theme);
  }, [theme]);

  useEffect(() => {
    // Light mode is force-disabled (FORCE_DARK_MODE), so the OS switching between
    // light/dark must NOT flip the app. This handler used to remove the `dark` class
    // when macOS went light, which left --foreground on its near-black light value
    // while every panel stayed dark → unreadable dark-on-dark text everywhere
    // (account menu, chat bubbles, dropdowns). Bail out entirely while dark is forced.
    if (FORCE_DARK_MODE) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("hatchin-theme")) {
        const newTheme = e.matches ? "dark" : "light";
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
