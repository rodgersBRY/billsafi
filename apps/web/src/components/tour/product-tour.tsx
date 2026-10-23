"use client";

import { PRODUCT_TOUR_VERSIONS, type ProductTourStatus } from "@billsafi/contracts";
import type { DriveStep, Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useEffect } from "react";
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
    },
  ];
  if (paymentInstructionsMissing) {
    steps.push({
      target: "account-menu",
      inSidebar: true,
      title: "Tell clients how to pay you",
      description:
        "Add your M-Pesa, Till, Paybill or bank details in Settings, from this menu. They print on every invoice.",
      mobileDescription:
        "Add your M-Pesa, Till, Paybill or bank details in Settings, from the menu at the top left. They print on every invoice.",
      side: "right",
    });
  }
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
        align: "start",
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

function saveTour(status: ProductTourStatus, lastStep: number) {
  apiSend("PUT", "/me/tours/first-run", {
    version: PRODUCT_TOUR_VERSIONS["first-run"],
    status,
    lastStep,
  }).catch(() => {
    // Not saved: the tour shows again next visit, which is harmless.
  });
}

// Next.js may keep an older render of the Overview; never run the tour twice per page load.
let shownThisLoad = false;

/** First-run tour of the Overview page (D057). */
export function ProductTour({
  autoStart,
  replay,
  paymentInstructionsMissing,
}: {
  autoStart: boolean;
  /** Started from "Take the tour" in the account menu. */
  replay: boolean;
  paymentInstructionsMissing: boolean;
}) {
  useEffect(() => {
    if (replay) {
      // Drop ?tour=1 so a reload does not start it again.
      window.history.replaceState(window.history.state, "", window.location.pathname);
    } else if (!autoStart || shownThisLoad) {
      return;
    }

    let tour: Driver | undefined;
    let cancelled = false;

    const stopWaiting = whenIntroDone(async () => {
      const { driver } = await import("driver.js");
      if (cancelled) return;
      shownThisLoad = true;

      const wide = window.matchMedia("(min-width: 48rem)").matches;
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      tour = driver({
        steps: toDriveSteps(tourSteps(paymentInstructionsMissing), wide),
        popoverClass: "billsafi-tour",
        showProgress: true,
        progressText: "{{current}} of {{total}}",
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
          if (!active.isLastStep()) {
            const skip = document.createElement("button");
            skip.type = "button";
            skip.textContent = "Skip tour";
            skip.className = "billsafi-tour-skip";
            // The public destroy() skips onDestroyStarted, so save here first.
            skip.addEventListener("click", () => {
              saveTour("dismissed", active.getActiveIndex() ?? 0);
              active.destroy();
            });
            popover.footer.prepend(skip);
          }
          popover.nextButton.focus();
        },
        // Runs for Done, Escape and the close button; not for destroy() calls.
        onDestroyStarted: (_element, _step, { driver: active }) => {
          saveTour(active.isLastStep() ? "completed" : "dismissed", active.getActiveIndex() ?? 0);
          active.destroy();
        },
      });
      tour.drive();
    });

    return () => {
      cancelled = true;
      stopWaiting();
      tour?.destroy();
    };
  }, [autoStart, replay, paymentInstructionsMissing]);

  return null;
}
