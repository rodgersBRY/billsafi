"use client";

import type { SavedItem } from "@billsafi/contracts";
import { useCallback, useEffect, useState } from "react";
import { apiPost, apiRequest } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";

export type SaveResult = { item: SavedItem } | { error: string; limitReached?: boolean };

/** The business's active saved items, for the line item dropdown. */
export function useSavedItems(businessId: string | undefined) {
  const [items, setItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    apiRequest<SavedItem[]>(`/businesses/${businessId}/items`)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      // The dropdown is a shortcut; typing still works without it.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const save = useCallback(
    async (line: {
      description: string;
      quantity: string;
      unitPrice: string;
    }): Promise<SaveResult> => {
      try {
        const item = await apiPost<SavedItem>(`/businesses/${businessId}/items`, line);
        setItems((current) => [...current, item]);
        return { item };
      } catch (error) {
        if (error instanceof ApiError && error.code === "SAVED_ITEM_LIMIT") {
          return { error: error.message, limitReached: true };
        }
        if (error instanceof ApiError && error.issues.length) {
          return { error: error.issues[0]!.message };
        }
        return { error: "Couldn't save this item. Try again." };
      }
    },
    [businessId],
  );

  return { items, save };
}
