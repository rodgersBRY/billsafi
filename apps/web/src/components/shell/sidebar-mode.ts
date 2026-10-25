/**
 * How a collapsible sidebar shows. "auto" follows the screen: an icon rail below
 * 1280px and the full sidebar from there. "rail" and "full" are the visitor's choice.
 */
export type SidebarMode = "auto" | "rail" | "full";

/** Class sets for each mode, so the sidebar and everything in it collapse together. */
export function sidebarClasses(mode: SidebarMode) {
  switch (mode) {
    case "rail":
      return {
        width: "w-17",
        label: "sr-only",
        center: "justify-center",
        expandedOnly: "hidden",
        tooltip: "",
      };
    case "full":
      return { width: "w-64", label: "", center: "", expandedOnly: "", tooltip: "hidden!" };
    default:
      return {
        width: "w-17 xl:w-64",
        label: "sr-only xl:not-sr-only",
        center: "justify-center xl:justify-start",
        expandedOnly: "hidden xl:inline-flex",
        tooltip: "xl:hidden!",
      };
  }
}
