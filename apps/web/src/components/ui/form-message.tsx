import { CircleAlert, CircleCheck } from "lucide-react";

export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  if (!children) return null;
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mt-4 flex items-start gap-2 text-sm ${
        tone === "error" ? "text-red-700 dark:text-red-300" : "text-accent"
      }`}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
