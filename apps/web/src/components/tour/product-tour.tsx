"use client";

import { PRODUCT_TOUR_VERSIONS, type ProductTourStatus } from "@billsafi/contracts";
import type { DriveStep, Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useEffect, useRef } from "react";
import { apiSend } from "@/lib/api.client";

interface TourStep {
  /** `data-tour` value of the element to highlight; none shows a centred card. */
  target?: string;
  /** The element lives in the sidebar, which is hidden behind the menu on small screens. */
  inSidebar?: boolean;
  title: string;
  description: string;
  mobileDescription?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

function tourSteps(paymentInstructionsMissing: boolean): TourStep[] {
  const steps: TourStep[] = [
    {
      title: "Welcome to Billsafi",
      description: "Here's where everything lives. It takes less than a minute.",
    },
    {
      target: "totals",
      title: "Your money at a glance",
      description:
        "What clients still owe you, what's past due, and what they paid this month. These update as you record payments.",
      side: "bottom",
    },
    {
      target: "create-invoice",
      title: "Create an invoice",
      description:
        "Start here. Save a draft, then Mark as Ready to give it a number, a PDF and a link to share.",
      side: "bottom",
    },
    {
      target: "main-nav",
      inSidebar: true,
      title: "Invoices and clients",
      description:
        "Every invoice and client is here. Open an invoice to share it or record a payment.",
      mobileDescription:
        "Open the menu at the top left to find Invoices and Clients. Open an invoice to share it or record a payment.",
      side: "right",
    },
    {
      target: "usage",
      inSidebar: true,
      title: "Your monthly allowance",
      description:
        "How many invoices you've marked Ready this month. Drafts don't count. Upgrade to Pro when you need more.",
      mobileDescription:
        "The menu at the top left also shows how many invoices you've marked Ready this month. Drafts don't count.",
      side: "right",
      align: "end",
    },
  ];
  const payNote = paymentInstructionsMissing
    ? " Start with Settings: add your M-Pesa, Till, Paybill or bank details so they print on every invoice."
    : "";
  steps.push({
    target: "account-menu",
    inSidebar: true,
    title: "Your account menu",
    description: `Settings, billing, this tour and sign out live here.${payNote}`,
    mobileDescription: `Settings, billing, this tour and sign out are at the bottom of the menu at the top left.${payNote}`,
    side: "right",
    align: "end",
  });
  return steps;
}

function toDriveSteps(steps: TourStep[], wide: boolean): DriveStep[] {
  return steps.map((step, index) => {
    const anchored = step.target && (wide || !step.inSidebar);
    return {
      element: anchored ? `[data-tour="${step.target}"]` : undefined,
      popover: {
        title: step.title,
        description: !wide && step.mobileDescription ? step.mobileDescription : step.description,
        side: step.side,
        align: step.align ?? "start",
        // Leave the key out elsewhere: an undefined value would hide the Done label.
        ...(index === 0 && { nextBtnText: "Show me around" }),
      },
    };
  });
}

/** Calls back once the post-login intro splash has gone. */
function whenIntroDone(callback: () => void): () => void {
  const html = document.documentElement;
  if (!("intro" in html.dataset)) {
    callback();
    return () => {};
  }
  const observer = new MutationObserver(() => {
    if ("intro" in html.dataset) return;
    observer.disconnect();
    callback();
  });
  observer.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
  return () => observer.disconnect();
}

/** Visual progress; driver's own "Step x of y" text stays for screen readers. */
function progressDots(active: Driver): HTMLElement {
  const dots = document.createElement("div");
  dots.className = "billsafi-tour-dots";
  dots.setAttribute("aria-hidden", "true");
  const current = active.getActiveIndex() ?? 0;
  const total = active.getConfig().steps?.length ?? 0;
  for (let index = 0; index < total; index++) {
    const dot = document.createElement("span");
    if (index === current) dot.dataset.active = "";
    else if (index < current) dot.dataset.done = "";
    dots.append(dot);
  }
  return dots;
}

function skipButton(active: Driver): HTMLButtonElement {
  const skip = document.createElement("button");
  skip.type = "button";
  skip.textContent = "Skip tour";
  skip.className = "billsafi-tour-skip";
  // The public destroy() skips onDestroyStarted, so save here first.
  skip.addEventListener("click", () => {
    saveTour("dismissed", active.getActiveIndex() ?? 0);
    active.destroy();
  });
  return skip;
}

function saveTour(status: ProductTourStatus, lastStep: number) {
  apiSend("PUT", "/me/tours/first-run", {
    version: PRODUCT_TOUR_VERSIONS["first-run"],
    status,
    lastStep,
  }).catch(() => {
    // Not saved: the tour shows again next visit, which is harmless.
  });
}

/** Lets "Take the tour" restart the tour on a page that is already open. */
export const START_TOUR_EVENT = "billsafi:start-tour";

async function createTour(paymentInstructionsMissing: boolean): Promise<Driver> {
  const { driver } = await import("driver.js");
  const wide = window.matchMedia("(min-width: 48rem)").matches;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return driver({
    steps: toDriveSteps(tourSteps(paymentInstructionsMissing), wide),
    popoverClass: "billsafi-tour",
    showProgress: true,
    progressText: "Step {{current}} of {{total}}",
    showButtons: ["next", "previous"],
    prevBtnText: "Back",
    nextBtnText: "Next",
    doneBtnText: "Done",
    animate: !calm,
    smoothScroll: !calm,
    stagePadding: 6,
    stageRadius: 10,
    overlayOpacity: 0.55,
    overlayClickBehavior: "none",
    disableActiveInteraction: true,
    onPopoverRender: (popover, { driver: active }) => {
      popover.wrapper.setAttribute("role", "dialog");
      popover.wrapper.setAttribute("aria-label", popover.title.textContent ?? "Product tour");
      // Nothing to go back to on the first step.
      if (active.isFirstStep()) popover.previousButton.style.display = "none";
      popover.footer.prepend(progressDots(active));
      if (!active.isLastStep()) popover.wrapper.append(skipButton(active));
      // driver.js focuses the first button (Back) after this hook; move focus to the
      // main action instead, without a focus ring for mouse users.
      requestAnimationFrame(() => popover.nextButton.focus({ focusVisible: false }));
    },
    // Runs for Done, Escape and the close button; not for destroy() calls.
    onDestroyStarted: (_element, _step, { driver: active }) => {
      saveTour(active.isLastStep() ? "completed" : "dismissed", active.getActiveIndex() ?? 0);
      active.destroy();
    },
  });
}

// Next.js may keep an older render of the Overview; never auto-start twice per page load.
let shownThisLoad = false;

/** First-run tour of the Overview page (D057). */
export function ProductTour({
  autoStart,
  replay,
  paymentInstructionsMissing,
}: {
  autoStart: boolean;
  /** Arrived from "Take the tour" in the account menu. */
  replay: boolean;
  paymentInstructionsMissing: boolean;
}) {
  const tourRef = useRef<Driver | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const tour = await createTour(paymentInstructionsMissing);
      if (cancelled) return;
      shownThisLoad = true;
      tourRef.current?.destroy();
      tourRef.current = tour;
      tour.drive();
    }

    let stopWaiting = () => {};
    if (replay) {
      // Drop ?tour=1 so a reload does not start it again.
      window.history.replaceState(window.history.state, "", window.location.pathname);
      stopWaiting = whenIntroDone(start);
    } else if (autoStart && !shownThisLoad) {
      stopWaiting = whenIntroDone(start);
    }

    // Already on the Overview: the account menu asks directly instead of navigating.
    const onRequest = () => void start();
    window.addEventListener(START_TOUR_EVENT, onRequest);

    return () => {
      cancelled = true;
      stopWaiting();
      window.removeEventListener(START_TOUR_EVENT, onRequest);
      tourRef.current?.destroy();
      tourRef.current = undefined;
    };
  }, [autoStart, replay, paymentInstructionsMissing]);

  return null;
}
