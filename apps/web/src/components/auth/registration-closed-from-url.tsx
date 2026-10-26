"use client";

import { REGISTRATION_CLOSED_CODE } from "@billsafi/contracts";
import { useSearchParams } from "next/navigation";
import { RegistrationClosedNotice } from "./registration-closed";

const FALLBACK = "Sign-ups are paused for now. Please check back soon.";
const MAX = 300;

/**
 * Where a first-time Google sign-in lands when registration is closed. The description is
 * shown as plain text only (React escapes it) and capped in length.
 */
export function RegistrationClosedFromUrl() {
  const params = useSearchParams();
  if (params.get("error") !== REGISTRATION_CLOSED_CODE) return null;
  const description = params.get("error_description")?.trim().slice(0, MAX);
  return <RegistrationClosedNotice message={description || FALLBACK} />;
}
