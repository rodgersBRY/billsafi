"use client";

import { SelectField, TextField } from "@/components/ui/field";

/** Form state for the optional discount and tax controls. */
export interface Adjustments {
  discountOn: boolean;
  discountType: "fixed" | "percentage";
  discountValue: string;
  taxOn: boolean;
  taxRate: string;
}

export interface AdjustmentsFieldsProps {
  value: Adjustments;
  onChange: (value: Adjustments) => void;
  errors: Record<string, string>;
  /**
   * Prepended to every error key this component reads, e.g. `discount.value`.
   * The public invoice generator nests invoice errors under `invoice.`.
   */
  errorPrefix?: string;
}

export function AdjustmentsFields({
  value,
  onChange,
  errors,
  errorPrefix = "",
}: AdjustmentsFieldsProps) {
  const set = (patch: Partial<Adjustments>) => onChange({ ...value, ...patch });

  return (
    <>
      <div className="mt-3.5 border-t border-line pt-3.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.discountOn}
            onChange={(event) => set({ discountOn: event.target.checked })}
            className="accent-teal"
          />
          Add discount <span className="text-xs text-sub">Optional</span>
        </label>
        {value.discountOn && (
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Discount type"
              value={value.discountType}
              onChange={(event) =>
                set({ discountType: event.target.value as "fixed" | "percentage" })
              }
            >
              <option value="fixed">Fixed amount (KES)</option>
              <option value="percentage">Percentage</option>
            </SelectField>
            <TextField
              label="Discount"
              inputMode="decimal"
              value={value.discountValue}
              error={errors[`${errorPrefix}discount.value`]}
              onChange={(event) => set({ discountValue: event.target.value })}
            />
          </div>
        )}
      </div>
      <div className="mt-3.5 border-t border-line pt-3.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.taxOn}
            onChange={(event) => set({ taxOn: event.target.checked })}
            className="accent-teal"
          />
          Add tax <span className="text-xs text-sub">Optional</span>
        </label>
        {value.taxOn && (
          <TextField
            label="Tax rate (%)"
            inputMode="decimal"
            value={value.taxRate}
            error={errors[`${errorPrefix}taxRate`]}
            onChange={(event) => set({ taxRate: event.target.value })}
          />
        )}
      </div>
    </>
  );
}
