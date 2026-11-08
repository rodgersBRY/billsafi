/**
 * How a collapsible sidebar shows. "auto" follows the screen: an icon rail below
 * 1280px and the full sidebar from there. "rail" and "full" are the visitor's choice.
 */
export type SidebarMode = "auto" | "rail" | "full";

/**
 * "group" reads the mode from a `data-sidebar` attribute on a `group/sidebar` ancestor.
 * Pure CSS, so content streamed in later never depends on when it hydrates.
 */
export type SidebarStyle = SidebarMode | "group";

/** Class sets for each mode, so the sidebar and everything in it collapse together. */
export function sidebarClasses(mode: SidebarStyle) {
  switch (mode) {
    // Written out in full so Tailwind finds every class.
    case "group":
      return {
        width: "",
        label:
          "group-data-[sidebar=rail]/sidebar:sr-only group-data-[sidebar=auto]/sidebar:max-xl:sr-only",
        center:
          "group-data-[sidebar=rail]/sidebar:justify-center group-data-[sidebar=auto]/sidebar:max-xl:justify-center",
        expandedOnly:
          "group-data-[sidebar=rail]/sidebar:hidden group-data-[sidebar=auto]/sidebar:max-xl:hidden",
        expandedBlock:
          "group-data-[sidebar=rail]/sidebar:hidden group-data-[sidebar=auto]/sidebar:max-xl:hidden",
        railOnly:
          "hidden group-data-[sidebar=rail]/sidebar:grid group-data-[sidebar=auto]/sidebar:max-xl:grid",
        // Shows on hover or focus of a `group/item` parent, only in the rail.
        tooltip:
          "hidden group-data-[sidebar=rail]/sidebar:group-hover/item:block group-data-[sidebar=rail]/sidebar:group-focus-within/item:block group-data-[sidebar=auto]/sidebar:max-xl:group-hover/item:block group-data-[sidebar=auto]/sidebar:max-xl:group-focus-within/item:block",
      };
    case "rail":
      return {
        width: "w-17",
        label: "sr-only",
        center: "justify-center",
        expandedOnly: "hidden",
        expandedBlock: "hidden",
        railOnly: "grid",
        tooltip: "",
      };
    case "full":
      return {
        width: "w-64",
        label: "",
        center: "",
        expandedOnly: "",
        expandedBlock: "",
        railOnly: "hidden",
        tooltip: "hidden!",
      };
    default:
      return {
        width: "w-17 xl:w-64",
        label: "sr-only xl:not-sr-only",
        center: "justify-center xl:justify-start",
        expandedOnly: "hidden xl:inline-flex",
        expandedBlock: "hidden xl:block",
        railOnly: "grid xl:hidden",
        tooltip: "xl:hidden!",
      };
  }
}
