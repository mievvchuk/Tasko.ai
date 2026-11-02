export type ThemePreference = "light" | "dark" | "system";
export const themeKey = "tasko.theme";

export function readThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean) {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function storedTheme(): ThemePreference {
  try {
    return readThemePreference(localStorage.getItem(themeKey));
  } catch {
    return "system";
  }
}

export function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(
    preference,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#111522" : "#f7f8fc");
}
