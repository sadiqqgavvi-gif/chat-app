import { useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./contexts";

const media = window.matchMedia("(prefers-color-scheme: dark)");

export function ThemeProvider({ children }) {
  // "light" | "dark" | "system"
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "system");
  const [systemDark, setSystemDark] = useState(media.matches);

  useEffect(() => {
    const onChange = (event) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
  }, [theme, isDark]);

  const value = useMemo(
    () => ({
      theme,
      isDark,
      setTheme,
      toggleTheme: () => setTheme(isDark ? "light" : "dark"),
    }),
    [theme, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
