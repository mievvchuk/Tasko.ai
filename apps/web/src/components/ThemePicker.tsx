import { useEffect, useState } from "react";
import { useLanguage } from "../i18n";
import {
  applyTheme,
  readThemePreference,
  storedTheme,
  themeKey,
} from "../theme";
import type { ThemePreference } from "../theme";

export function ThemePicker() {
  const { language } = useLanguage();
  const [preference, setPreference] = useState<ThemePreference>(storedTheme);
  useEffect(() => {
    applyTheme(preference);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystem = () => applyTheme(preference);
    const sync = (event: StorageEvent) => {
      if (event.key === themeKey || event.key === null)
        setPreference(readThemePreference(event.newValue));
    };
    media.addEventListener("change", updateSystem);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", updateSystem);
      window.removeEventListener("storage", sync);
    };
  }, [preference]);
  const uk = language === "uk";
  return (
    <label className="theme-picker">
      <span className="theme-picker-label">{uk ? "Тема" : "Theme"}</span>
      <select
        aria-label={uk ? "Тема сайту" : "Site theme"}
        value={preference}
        onChange={(event) => {
          const value = readThemePreference(event.target.value);
          setPreference(value);
          try {
            localStorage.setItem(themeKey, value);
          } catch {
            /* Still works for this visit. */
          }
        }}
      >
        <option value="light">{uk ? "Світла" : "Light"}</option>
        <option value="dark">{uk ? "Темна" : "Dark"}</option>
        <option value="system">{uk ? "Системна" : "System"}</option>
      </select>
    </label>
  );
}
