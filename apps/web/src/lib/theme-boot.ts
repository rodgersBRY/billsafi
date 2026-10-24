/** Shared with lib/theme.ts. Kept free of React so the root layout can import it. */
export const THEME_STORAGE_KEY = "billsafi:theme";

/**
 * Runs before hydration (see app/layout.tsx) so a saved choice applies on first
 * paint. With nothing saved, data-theme stays unset and the device setting wins.
 */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
