"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD = 8;

/** Name and password only; the sign-in email stays fixed in V1 (D052). */
export function AccountSettings({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string>();
  const [nameSaved, setNameSaved] = useState<string>();
  const [namePending, setNamePending] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordSaved, setPasswordSaved] = useState<string>();
  const [passwordPending, setPasswordPending] = useState(false);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setNameError("Name is required");
    setNamePending(true);
    setNameError(undefined);
    const { error } = await authClient.updateUser({ name: trimmed });
    setNamePending(false);
    if (error) return setNameError(error.message ?? "Could not save your name");
    setNameSaved("Name saved.");
    router.refresh();
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!current) errors.current = "Enter your current password";
    if (next.length < MIN_PASSWORD) errors.next = `Use at least ${MIN_PASSWORD} characters`;
    setPasswordErrors(errors);
    if (Object.keys(errors).length) return;
    setPasswordPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setPasswordPending(false);
    if (error) {
      return setPasswordErrors(
        error.code === "INVALID_PASSWORD"
          ? { current: "That isn't your current password" }
          : { form: error.message ?? "Could not change your password" },
      );
    }
    setCurrent("");
    setNext("");
    setPasswordSaved("Password changed. Your other devices have been signed out.");
  }

  return (
    <>
      <form onSubmit={saveName} noValidate>
        <h2 className="text-base font-semibold">Your details</h2>
        <TextField
          label="Full name"
          value={name}
          onChange={(event) => {
            setNameSaved(undefined);
            setName(event.target.value);
          }}
          error={nameError}
          autoComplete="name"
        />
        <TextField
          label="Email address"
          value={user.email}
          readOnly
          hint="Your sign-in email can't be changed yet."
        />
        <div aria-live="polite">
          <FormMessage tone="success">{nameSaved}</FormMessage>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" pending={namePending}>
            Save name
          </Button>
        </div>
      </form>

      <form onSubmit={changePassword} noValidate className="mt-6 border-t border-line pt-5">
        <h2 className="text-base font-semibold">Change password</h2>
        <p className="mt-1 text-sm text-sub">
          Changing your password signs you out on your other devices.
        </p>
        <TextField
          label="Current password"
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          error={passwordErrors.current}
          autoComplete="current-password"
        />
        <TextField
          label="New password"
          type="password"
          value={next}
          onChange={(event) => {
            setPasswordSaved(undefined);
            setNext(event.target.value);
          }}
          error={passwordErrors.next}
          hint={`At least ${MIN_PASSWORD} characters.`}
          autoComplete="new-password"
        />
        <div aria-live="polite">
          <FormMessage>{passwordErrors.form}</FormMessage>
          <FormMessage tone="success">{passwordSaved}</FormMessage>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" pending={passwordPending}>
            Change password
          </Button>
        </div>
      </form>
    </>
  );
}
