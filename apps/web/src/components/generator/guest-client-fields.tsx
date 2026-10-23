"use client";

import { TextField } from "@/components/ui/field";
import type { Errors, GuestClient } from "./guest-form-state";

export interface GuestClientFieldsProps {
  client: GuestClient;
  onClientChange: (client: GuestClient) => void;
  issueDate: string;
  dueDate: string;
  onDatesChange: (dates: { issueDate: string; dueDate: string }) => void;
  errors: Errors;
}

export function GuestClientFields(props: GuestClientFieldsProps) {
  const { client, errors } = props;
  const set = (patch: Partial<GuestClient>) => props.onClientChange({ ...client, ...patch });

  return (
    <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
      <h2 className="text-base font-semibold">Bill to</h2>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <TextField
          label="Client name"
          value={client.name}
          error={errors["client.name"]}
          onChange={(event) => set({ name: event.target.value })}
        />
        <TextField
          label="Client phone"
          type="tel"
          placeholder="+44 20 7946 0958"
          value={client.phone}
          error={errors["client.phone"]}
          onChange={(event) => set({ phone: event.target.value })}
        />
        <TextField
          label="Client email · Optional"
          type="email"
          value={client.email}
          error={errors["client.email"]}
          onChange={(event) => set({ email: event.target.value })}
        />
        <TextField
          label="Company name · Optional"
          value={client.companyName}
          error={errors["client.companyName"]}
          onChange={(event) => set({ companyName: event.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Issue date"
          type="date"
          value={props.issueDate}
          error={errors["invoice.issueDate"]}
          onChange={(event) =>
            props.onDatesChange({ issueDate: event.target.value, dueDate: props.dueDate })
          }
        />
        <TextField
          label="Due date"
          type="date"
          value={props.dueDate}
          error={errors["invoice.dueDate"]}
          onChange={(event) =>
            props.onDatesChange({ issueDate: props.issueDate, dueDate: event.target.value })
          }
        />
      </div>
    </section>
  );
}
