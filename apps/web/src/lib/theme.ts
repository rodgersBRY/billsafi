import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-boot";

export type Theme = "light" | "dark";

const CHANGE_EVENT = "billsafi:theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The theme on screen right now, whether the user picked it or the device did. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}

/** Saves the user's choice; it then overrides the device setting on this browser. */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the choice still holds until the next full page load.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
