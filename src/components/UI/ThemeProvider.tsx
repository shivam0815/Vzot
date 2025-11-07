import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInit = (): Theme =>
    (localStorage.getItem("theme") as Theme) ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  const [theme, setTheme] = useState<Theme>(getInit);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme(t => (t === "dark" ? "light" : "dark")) }}>
      {children}
    </Ctx.Provider>
  );
};

export const useTheme = () => useContext(Ctx)!;
