import type { MailMessage } from "./mailer.js";

export function passwordResetEmail(to: string, name: string, url: string): MailMessage {
  return {
    to,
    subject: "Reset your TallyNest password",
    text: [
      `Hi ${name},`,
      "",
      "Someone asked to reset the password for your TallyNest account.",
      "Use this link within the next hour to choose a new password:",
      "",
      url,
      "",
      "Resetting your password signs you out on every device.",
      "If you didn't ask for this, you can ignore this email.",
    ].join("\n"),
  };
}
