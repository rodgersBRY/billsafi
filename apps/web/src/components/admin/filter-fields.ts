/* Filter definitions for FilterBar, kept out of the client module so server pages can build them. */

/** One choice in a select; its params replace the select's `names` in the URL. */
export interface FilterOption {
  label: string;
  params: Record<string, string>;
}

export type FilterField =
  | { type: "search" | "text"; name: string; label: string; placeholder?: string }
  | { type: "date"; name: string; label: string }
  | { type: "select"; label: string; names: string[]; options: FilterOption[] };

/** A select over one URL param, with "any" first. */
export function selectField(
  name: string,
  label: string,
  anyLabel: string,
  entries: readonly (readonly [string, string])[],
): FilterField {
  return {
    type: "select",
    label,
    names: [name],
    options: [
      { label: anyLabel, params: {} },
      ...entries.map(([value, text]) => ({ label: text, params: { [name]: value } })),
    ],
  };
}
