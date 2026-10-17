"use client";

import {
  type Business,
  type BusinessProfileType,
  updateBusinessSchema,
} from "@tallynest/contracts";
import { ImageUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiRequest, apiSend } from "@/lib/api.client";
import { ApiError, parseApiResponse } from "@/lib/api-error";
import { initials } from "@/lib/format";
import { logoUrl } from "@/lib/logo";
import { type Errors, issuesToErrors } from "./form-errors";

const LOGO_MAX_BYTES = 512 * 1024;

/** Shows a stored +2547XXXXXXXX number as 07XX XXX XXX for editing. */
function localPhone(stored: string): string {
  const local = `0${stored.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

export function ProfileSettings({ business }: { business: Business }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoKey, setLogoKey] = useState(business.logoKey);
  const [logoPending, setLogoPending] = useState(false);
  const [logoError, setLogoError] = useState<string>();
  const [profileType, setProfileType] = useState<BusinessProfileType>(business.profileType);
  const [details, setDetails] = useState({
    displayName: business.displayName,
    contactEmail: business.contactEmail,
    phone: localPhone(business.phone),
    address: business.address ?? "",
    kraPin: business.kraPin ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState<string>();
  const [pending, setPending] = useState(false);

  function update(field: keyof typeof details) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setSaved(undefined);
      setDetails((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  async function uploadLogo(file: File) {
    setLogoError(undefined);
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      return setLogoError("Choose a PNG or JPEG image");
    }
    if (file.size > LOGO_MAX_BYTES) return setLogoError("The logo must be 512 KB or smaller");
    setLogoPending(true);
    try {
      const response = await fetch(`/api/v1/businesses/${business.id}/logo`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const updated = await parseApiResponse<Business>(response);
      setLogoKey(updated.logoKey);
      router.refresh();
    } catch (error) {
      setLogoError(error instanceof ApiError ? error.message : "Could not upload the logo");
    } finally {
      setLogoPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeLogo() {
    setLogoPending(true);
    setLogoError(undefined);
    try {
      await apiSend<Business>("DELETE", `/businesses/${business.id}/logo`);
      setLogoKey(null);
      router.refresh();
    } catch {
      setLogoError("Could not remove the logo");
    } finally {
      setLogoPending(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const body = { profileType, ...details };
    const parsed = updateBusinessSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setPending(true);
    setErrors({});
    try {
      await apiRequest<Business>(`/businesses/${business.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setSaved("Changes saved. New invoices use these details.");
      router.refresh();
    } catch (error) {
      setErrors(
        error instanceof ApiError && error.issues.length
          ? error.fieldErrors()
          : { form: "Something went wrong. Please try again." },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h2 className="text-base font-semibold">Your invoice identity</h2>
      <p className="mt-1 text-sm text-sub">Contact details for this business.</p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        {logoKey ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated, same-origin API image
          <img
            src={logoUrl(business.id, logoKey)}
            alt={`${business.displayName} logo`}
            className="size-16 rounded-panel border border-line bg-white object-contain p-1"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-16 place-items-center rounded-panel bg-soft text-lg font-semibold text-teal"
          >
            {initials(business.displayName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            Business logo <span className="text-xs text-sub">· Optional</span>
          </p>
          <p className="text-xs text-sub">PNG or JPEG, up to 512 KB. Appears on your invoices.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              id="logo-file"
              aria-label="Upload logo"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              pending={logoPending}
              onClick={() => fileRef.current?.click()}
            >
              <ImageUp aria-hidden className="size-4" />
              {logoKey ? "Replace logo" : "Upload logo"}
            </Button>
            {logoKey && (
              <Button type="button" variant="ghost" disabled={logoPending} onClick={removeLogo}>
                <Trash2 aria-hidden className="size-4" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <FormMessage>{logoError}</FormMessage>

      <form onSubmit={save} noValidate className="mt-5 border-t border-line pt-1">
        <div role="group" aria-label="Profile type" className="mt-4 grid grid-cols-2 gap-2.5">
          {(
            [
              ["individual", "Individual"],
              ["business", "Business"],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              aria-pressed={profileType === type}
              onClick={() => {
                setSaved(undefined);
                setProfileType(type);
              }}
              className="rounded-panel border border-line bg-panel px-3.75 py-2.75 text-sm aria-pressed:border-teal aria-pressed:bg-soft aria-pressed:text-teal"
            >
              {label}
            </button>
          ))}
        </div>
        <TextField
          label="Display name"
          value={details.displayName}
          onChange={update("displayName")}
          error={errors.displayName}
          autoComplete="organization"
        />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <TextField
            label="Contact email"
            type="email"
            value={details.contactEmail}
            onChange={update("contactEmail")}
            error={errors.contactEmail}
            autoComplete="email"
          />
          <TextField
            label="Phone"
            type="tel"
            placeholder="07XX XXX XXX"
            value={details.phone}
            onChange={update("phone")}
            error={errors.phone}
            autoComplete="tel"
          />
        </div>
        <TextField
          label="Address · Optional"
          value={details.address}
          onChange={update("address")}
          error={errors.address}
          autoComplete="street-address"
        />
        <TextField
          label="KRA PIN · Optional"
          value={details.kraPin}
          onChange={update("kraPin")}
          error={errors.kraPin}
        />
        <p className="mt-3 text-xs text-sub">
          Invoices already marked Ready keep the details they were issued with.
        </p>
        <div aria-live="polite">
          <FormMessage>{errors.form}</FormMessage>
          <FormMessage tone="success">{saved}</FormMessage>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" pending={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </>
  );
}
