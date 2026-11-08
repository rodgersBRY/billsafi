"use client";

import type { WhatsNewFeed } from "@billsafi/contracts";
import { useSyncExternalStore } from "react";
import { apiPost, apiRequest } from "@/lib/api.client";

interface WhatsNewState {
  feed: WhatsNewFeed | null;
  open: boolean;
}

// Shared by the sidebar button and the panel, which render in different parts of the page.
let state: WhatsNewState = { feed: null, open: false };
const SERVER_STATE: WhatsNewState = { feed: null, open: false };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function update(next: Partial<WhatsNewState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWhatsNew(): WhatsNewState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}

/** Opens the panel and records that the user has seen everything listed. */
export function openWhatsNew() {
  const feed = state.feed;
  update({ open: true });
  if (feed && feed.unreadCount > 0) {
    // "New" markers stay until the panel closes; the count clears straight away.
    update({ feed: { ...feed, unreadCount: 0, popup: false } });
    apiPost<void>("/whats-new/seen", {}).catch(() => undefined);
  }
}

export function closeWhatsNew() {
  const feed = state.feed;
  update({
    open: false,
    feed: feed && { ...feed, entries: feed.entries.map((entry) => ({ ...entry, unread: false })) },
  });
}

/** Loads the feed once per page load. A failure only means no count and no pop-up. */
export function loadWhatsNew(): Promise<void> {
  loading ??= apiRequest<WhatsNewFeed>("/whats-new")
    .then((feed) => {
      update({ feed });
      if (feed.popup) openWhatsNew();
    })
    .catch(() => {
      loading = null;
    });
  return loading;
}
