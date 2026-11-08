import { BrandMark } from "@/components/ui/brand-mark";
import { sidebarClasses } from "./sidebar-mode";

const classes = sidebarClasses("group");

/** The logo at the top of the app sidebar; only the mark shows in the rail. */
export function SidebarBrand() {
  return (
    <div className={`flex ${classes.center}`}>
      <BrandMark size={28} labelClassName={classes.label} />
    </div>
  );
}
