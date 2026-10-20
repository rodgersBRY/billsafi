export const settingsTabs = [
  { id: "profile", label: "Business profile" },
  { id: "payment", label: "Payment instructions" },
  { id: "defaults", label: "Invoice defaults" },
  { id: "account", label: "Account" },
] as const;
export type SettingsTab = (typeof settingsTabs)[number]["id"];
