"use client";

import type { BusinessProfileType } from "@billsafi/contracts";
import { SelectField, TextField } from "@/components/ui/field";
import type { Errors, GuestBusiness } from "./guest-form-state";

export function GuestBusinessFields({
  value,
  onChange,
  errors,
}: {
  value: GuestBusiness;
  onChange: (value: GuestBusiness) => void;
  errors: Errors;
}) {
  const set = (patch: Partial<GuestBusiness>) => onChange({ ...value, ...patch });

  return (
    <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
      <h2 className="text-base font-semibold">Your business</h2>
      <SelectField
        label="You invoice as"
        value={value.profileType}
        error={errors["business.profileType"]}
        onChange={(event) => set({ profileType: event.target.value as BusinessProfileType })}
      >
        <option value="individual">An individual</option>
        <option value="business">A business</option>
      </SelectField>
      <TextField
        label="Display name"
        autoComplete="organization"
        hint="The name your clients see on the invoice."
        value={value.displayName}
        error={errors["business.displayName"]}
        onChange={(event) => set({ displayName: event.target.value })}
      />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={value.contactEmail}
          error={errors["business.contactEmail"]}
          onChange={(event) => set({ contactEmail: event.target.value })}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
          value={value.phone}
          error={errors["business.phone"]}
          onChange={(event) => set({ phone: event.target.value })}
        />
      </div>
      <TextField
        label="Address · Optional"
        autoComplete="street-address"
        value={value.address}
        error={errors["business.address"]}
        onChange={(event) => set({ address: event.target.value })}
      />
      <TextField
        label="KRA PIN · Optional"
        value={value.kraPin}
        error={errors["business.kraPin"]}
        onChange={(event) => set({ kraPin: event.target.value })}
      />
    </section>
  );
}
