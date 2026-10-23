import { z } from "zod";
import { phone, optionalText, requiredText } from "./fields.js";

const optionalEmail = z
  .union([z.literal(""), z.email("Enter a valid email address").trim().max(254)])
  .transform((value) => (value === "" ? null : value))
  .nullish();

export const createClientSchema = z.object({
  name: requiredText("Client name", 120),
  phone,
  email: optionalEmail,
  companyName: optionalText(160),
  address: optionalText(300),
  kraPin: optionalText(20).transform((value) => value?.toUpperCase() ?? null),
});
export type CreateClientInput = z.input<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();
export type UpdateClientInput = z.input<typeof updateClientSchema>;

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  address: string | null;
  kraPin: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
