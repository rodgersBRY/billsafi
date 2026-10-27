"use client";

import {
  type AdminActionAck,
  type AdminSetting,
  announcementTones,
  platformSettingSchemas,
} from "@billsafi/contracts";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { AnnouncementBanner } from "@/components/announcement/announcement-banner";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { FormActionDialog } from "../subscription-actions/form-action-dialog";
import { issuesByField } from "../subscription-actions/issues";

const MESSAGE_MAX = 200;

/** An ISO instant as the Nairobi wall-clock value a datetime-local input takes. */
function toInput(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 16);
}

/** The reverse: a datetime-local value is read as Nairobi time (+03:00). */
function fromInput(value: string): string | undefined {
  return value ? `${value}:00+03:00` : undefined;
}

type Shared = { onClose: () => void };
type Errors = Record<string, string>;

function useChecked<K extends keyof typeof platformSettingSchemas>(key: K) {
  const [errors, setErrors] = useState<Errors>({});
  function check(value: unknown) {
    const parsed = platformSettingSchemas[key].safeParse(value);
    const next = parsed.success ? {} : issuesByField(parsed.error.issues);
    setErrors(next);
    return Object.keys(next).length ? null : { value };
  }
  /** The API reports paths like value.message; the form keys its errors by field. */
  function onIssues(issues: { path: string; message: string }[]) {
    setErrors(issuesByField(issues.map((i) => ({ ...i, path: i.path.replace(/^value\./, "") }))));
  }
  return { errors, check, onIssues };
}

const put = {
  method: "PUT" as const,
  successMessage: () => "Setting saved.",
};

function RegistrationDialog({
  setting,
  onClose,
}: Shared & { setting: AdminSetting<"registration"> }) {
  const [open, setOpen] = useState(setting.value.open);
  const [message, setMessage] = useState(setting.value.closedMessage);
  const { errors, check, onIssues } = useChecked("registration");
  const closing = setting.value.open && !open;
  return (
    <FormActionDialog<AdminSetting | AdminActionAck>
      {...put}
      title="Registration"
      target={{ name: "New sign-ups", detail: setting.value.open ? "Open now" : "Closed now" }}
      path="/admin/settings/registration"
      submitLabel={closing ? "Close sign-ups" : "Save"}
      destructive={closing}
      buildBody={() => check({ open, closedMessage: message.trim() })}
      onServerIssues={onIssues}
      preview={
        closing
          ? "New people can't sign up by email or Google. Existing users keep signing in."
          : open
            ? "Anyone can sign up."
            : "Sign-ups stay closed. The message is shown on the sign-up page."
      }
      onClose={onClose}
    >
      <label className="mt-4 flex min-h-11 items-center gap-2 text-sm md:min-h-0">
        <input
          type="checkbox"
          checked={open}
          onChange={(event) => setOpen(event.target.checked)}
          className="size-4 accent-teal"
        />
        Sign-ups are open
      </label>
      <TextAreaField
        label="Message shown when closed"
        value={message}
        maxLength={MESSAGE_MAX}
        onChange={(event) => setMessage(event.target.value)}
        error={errors.closedMessage}
        hint={`${message.length} of ${MESSAGE_MAX}`}
      />
    </FormActionDialog>
  );
}

function AnnouncementDialog({
  setting,
  onClose,
}: Shared & { setting: AdminSetting<"announcement"> }) {
  const v = setting.value;
  const [active, setActive] = useState(v.active);
  const [tone, setTone] = useState<string>(v.tone);
  const [message, setMessage] = useState(v.message);
  const [linkUrl, setLinkUrl] = useState(v.linkUrl ?? "");
  const [startsAt, setStartsAt] = useState(toInput(v.startsAt));
  const [endsAt, setEndsAt] = useState(toInput(v.endsAt));
  const { errors, check, onIssues } = useChecked("announcement");

  function value() {
    return {
      active,
      tone,
      message: message.trim(),
      ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
      ...(startsAt ? { startsAt: fromInput(startsAt) } : {}),
      ...(endsAt ? { endsAt: fromInput(endsAt) } : {}),
    };
  }

  return (
    <FormActionDialog<AdminSetting | AdminActionAck>
      {...put}
      title="Announcement banner"
      target={{ name: "Banner", detail: v.active ? "On now" : "Off now" }}
      path="/admin/settings/announcement"
      submitLabel="Save"
      buildBody={() => check(value())}
      onServerIssues={onIssues}
      preview={
        <div className="space-y-2">
          <p className="text-xs text-sub">
            {active ? "Preview of the banner" : "Banner is off. Preview only"}
          </p>
          <AnnouncementBanner
            preview
            tone={tone === "warning" ? "warning" : "info"}
            message={message.trim() || "Your message appears here."}
            linkUrl={linkUrl.trim().startsWith("https://") ? linkUrl.trim() : null}
          />
        </div>
      }
      onClose={onClose}
    >
      <label className="mt-4 flex min-h-11 items-center gap-2 text-sm md:min-h-0">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="size-4 accent-teal"
        />
        Show the banner
      </label>
      <SelectField
        label="Tone"
        value={tone}
        onChange={(event) => setTone(event.target.value)}
        error={errors.tone}
      >
        {announcementTones.map((value) => (
          <option key={value} value={value}>
            {value === "info" ? "Info" : "Warning"}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label="Message"
        value={message}
        maxLength={MESSAGE_MAX}
        onChange={(event) => setMessage(event.target.value)}
        error={errors.message}
        hint={`${message.length} of ${MESSAGE_MAX}`}
      />
      <TextField
        label="Link (optional)"
        type="url"
        inputMode="url"
        placeholder="https://"
        value={linkUrl}
        onChange={(event) => setLinkUrl(event.target.value)}
        error={errors.linkUrl}
      />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <TextField
          label="Starts (optional)"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          error={errors.startsAt}
        />
        <TextField
          label="Ends (optional)"
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          error={errors.endsAt}
        />
      </div>
    </FormActionDialog>
  );
}

function SupportContactDialog({
  setting,
  onClose,
}: Shared & { setting: AdminSetting<"support_contact"> }) {
  const v = setting.value;
  const [email, setEmail] = useState(v.email);
  const [whatsapp, setWhatsapp] = useState(v.whatsapp ?? "");
  const [hours, setHours] = useState(v.hours ?? "");
  const { errors, check, onIssues } = useChecked("support_contact");
  return (
    <FormActionDialog<AdminSetting | AdminActionAck>
      {...put}
      title="Support contact"
      target={{ name: "Support contact", detail: v.email }}
      path="/admin/settings/support_contact"
      submitLabel="Save"
      buildBody={() =>
        check({
          email: email.trim(),
          ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
          ...(hours.trim() ? { hours: hours.trim() } : {}),
        })
      }
      onServerIssues={onIssues}
      preview={`People will be told to write to ${email.trim() || "an email address"}.`}
      onClose={onClose}
    >
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
      />
      <TextField
        label="WhatsApp (optional)"
        type="tel"
        placeholder="+254712345678"
        value={whatsapp}
        onChange={(event) => setWhatsapp(event.target.value)}
        error={errors.whatsapp}
      />
      <TextField
        label="Hours (optional)"
        value={hours}
        maxLength={100}
        placeholder="Mon-Fri, 9am to 5pm"
        onChange={(event) => setHours(event.target.value)}
        error={errors.hours}
      />
    </FormActionDialog>
  );
}

/** The Edit button of one setting card, and its dialog while open. */
export function SettingEditor({ setting }: { setting: AdminSetting }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 md:min-h-0"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden className="size-4" />
        Edit
        <span className="sr-only"> {setting.label}</span>
      </Button>
      {open && setting.key === "registration" && (
        <RegistrationDialog setting={setting} onClose={close} />
      )}
      {open && setting.key === "announcement" && (
        <AnnouncementDialog setting={setting} onClose={close} />
      )}
      {open && setting.key === "support_contact" && (
        <SupportContactDialog setting={setting} onClose={close} />
      )}
    </>
  );
}
