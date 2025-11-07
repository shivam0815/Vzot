// e.g., src/components/UI/ThemeToggle.tsx
import { useTheme } from "./ThemeProvider";
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700
                 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
