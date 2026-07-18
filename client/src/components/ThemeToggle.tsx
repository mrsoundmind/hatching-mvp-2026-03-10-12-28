import { Sun, Moon } from "lucide-react";
import { useTheme, FORCE_DARK_MODE } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  // #114: while light mode is disabled the toggle does nothing — hide it rather than render a dead
  // control that silently ignores clicks.
  if (FORCE_DARK_MODE) return null;

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 w-full px-3 py-2 text-sm hatchin-text hover:bg-hatchin-border transition-colors rounded-md"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
