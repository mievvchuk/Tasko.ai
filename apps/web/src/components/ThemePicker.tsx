import { useEffect, useState } from "react";
import { useLanguage } from "../i18n";
import {
  applyTheme,
  readThemePreference,
  storedTheme,
  themeKey,
} from "../theme";
import type { ThemePreference } from "../theme";
import { IconMenu } from "./IconMenu";
import type { IconMenuOption } from "./IconMenu";

export function ThemePicker() {
  const { language, tr } = useLanguage();
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
  const options: IconMenuOption<ThemePreference>[] = [
    { value: "light", label: uk ? tr("Світла") : "Light", icon: "bi-sun" },
    { value: "dark", label: uk ? tr("Темна") : "Dark", icon: "bi-moon-stars" },
    { value: "system", label: uk ? tr("Системна") : "System", icon: "bi-display" },
  ];
  const current = options.find((option) => option.value === preference)!;
  return (
    <IconMenu
      icon={current.icon!}
      label={`${uk ? tr("Тема сайту") : "Site theme"}: ${current.label}`}
      value={preference}
      options={options}
      onChange={(value) => {
        setPreference(value);
        try {
          localStorage.setItem(themeKey, value);
        } catch {
          /* Still works for this visit. */
        }
      }}
    />
  );
}
