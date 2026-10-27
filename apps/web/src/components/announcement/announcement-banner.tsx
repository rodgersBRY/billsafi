"use client";

import { ExternalLink, Info, TriangleAlert, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

export interface AnnouncementBannerProps {
  tone: "info" | "warning";
  message: string;
  linkUrl: string | null;
  /** A static copy for the admin's live preview: no dismiss button, nothing stored. */
  preview?: boolean;
}

const EVENT = "billsafi:announcement";
const tones = {
  info: { box: "border-info-line bg-info-bg text-info-ink", Icon: Info },
  warning: { box: "border-warning-line bg-warning-bg text-warning-ink", Icon: TriangleAlert },
} as const;

/** A short stable id for a message, so a new message is shown again after a dismissal. */
export function announcementKey(
  props: Pick<AnnouncementBannerProps, "tone" | "message" | "linkUrl">,
) {
  let hash = 5381;
  for (const char of `${props.tone}|${props.message}|${props.linkUrl ?? ""}`) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0;
  }
  return `billsafi.announcement.${(hash >>> 0).toString(36)}`;
}

function wasDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * The platform announcement, in the app and on the landing page. Dismissing hides this exact
 * message on this device; storage that is blocked only means it comes back next visit.
 */
export function AnnouncementBanner(props: AnnouncementBannerProps) {
  const { tone, message, linkUrl, preview } = props;
  const key = announcementKey(props);
  const stored = useSyncExternalStore(
    subscribe,
    () => !preview && wasDismissed(key),
    () => false,
  );
  const [hiddenNow, setHiddenNow] = useState(false);
  if (stored || hiddenNow) return null;

  const { box, Icon } = tones[tone];
  function dismiss() {
    setHiddenNow(true);
    try {
      window.localStorage.setItem(key, "1");
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Storage is blocked: the banner stays hidden until the page reloads.
    }
  }

  return (
    <div
      role={preview ? undefined : "region"}
      aria-label={preview ? undefined : "Announcement"}
      className={`flex items-start gap-3 border-b px-4 py-2.5 text-sm sm:px-7 ${box} ${preview ? "rounded-panel border" : ""}`}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1 leading-normal break-words">
        {message}
        {linkUrl && (
          <>
            {" "}
            <a
              href={linkUrl}
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
            >
              Learn more
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </>
        )}
      </span>
      {!preview && (
        <button
          type="button"
          onClick={dismiss}
          className="-my-1.5 -mr-2 grid size-11 shrink-0 place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 md:size-8"
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Dismiss announcement</span>
        </button>
      )}
    </div>
  );
}
