"use client";

import { ArrowLeft, ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import { createContext, use, useLayoutEffect, useRef, useState } from "react";
import s from "./landing.module.css";

type OpenPreview = (plan?: string) => void;

const PreviewContext = createContext<OpenPreview>(() => {});

const DEFAULT_TITLE = "Your next invoice starts here.";
const DEFAULT_DESCRIPTION =
  "Try the sample below. This preview does not create an account or send an invoice.";

interface SampleInvoice {
  client: string;
  service: string;
  amount: string;
}

/**
 * Hosts the landing page's sample-invoice dialog. Nothing here creates an account,
 * sends an invoice, or processes a payment; it only renders what the visitor typed.
 */
export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const clientRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<string>();
  const [sample, setSample] = useState<SampleInvoice | null>(null);

  // Next.js keeps visited pages alive; never come back to an open dialog.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  const open: OpenPreview = (nextPlan) => {
    setPlan(nextPlan);
    setSample(null);
    ref.current?.showModal();
  };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSample({
      client: String(data.get("client")),
      service: String(data.get("service")),
      amount: `KSh ${Number(data.get("amount")).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`,
    });
  }

  function onBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    const dialog = ref.current;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outside) dialog.close();
  }

  return (
    <PreviewContext value={open}>
      {children}
      <dialog
        ref={ref}
        className={s.dialog}
        aria-labelledby="preview-title"
        aria-describedby="preview-description"
        onClick={onBackdropClick}
      >
        <div className={s.modalHead}>
          <span className={s.eyebrow}>BILLSAFI · INTERACTIVE SAMPLE</span>
          <button
            className={s.close}
            aria-label="Close preview"
            onClick={() => ref.current?.close()}
          >
            <X aria-hidden />
          </button>
        </div>
        <div className={s.modalBody}>
          <h2 id="preview-title">{plan ? `Explore the ${plan} concept.` : DEFAULT_TITLE}</h2>
          <p id="preview-description">
            {plan
              ? "This plan and its price are illustrative. Try a sample invoice below; no account or subscription is created."
              : DEFAULT_DESCRIPTION}
          </p>
          {/* The form stays mounted while the sample shows, so edits survive "Edit sample". */}
          <form onSubmit={onSubmit} hidden={sample !== null}>
            <label>
              Client name
              <input
                ref={clientRef}
                name="client"
                required
                maxLength={60}
                defaultValue="Karibu Coffee"
              />
            </label>
            <div className={s.formGrid}>
              <label>
                Service
                <input
                  name="service"
                  required
                  maxLength={100}
                  defaultValue="Social content design"
                />
              </label>
              <label>
                Amount (KSh)
                <input
                  name="amount"
                  type="number"
                  required
                  min={1}
                  max={99999999}
                  defaultValue={24000}
                />
              </label>
            </div>
            <button className={`${s.button} ${s.dark}`} type="submit">
              Preview invoice{" "}
              <span>
                <ArrowUpRight className={s.icon} aria-hidden />
              </span>
            </button>
          </form>
          {sample && (
            <div>
              <div className={s.sampleGenerated}>
                <div className={s.sheetHeading}>
                  <span className={s.paperMark}>a.</span>
                  <b>INVOICE INV-025</b>
                </div>
                <p>FROM AMANI NJERI · NAIROBI</p>
                <small>BILL TO</small>
                <h3>{sample.client}</h3>
                <div className={s.paperLine}>
                  <span>{sample.service}</span>
                  <b>{sample.amount}</b>
                </div>
                <p>
                  Payment instructions: Pay directly using the M-Pesa or bank details supplied by
                  your freelancer.
                </p>
                <small>SAMPLE INVOICE · NOT SENT · NO PAYMENT PROCESSED</small>
              </div>
              <button
                className={`${s.button} ${s.outline}`}
                onClick={() => {
                  setSample(null);
                  // The form is hidden until React commits; focus once it is visible again.
                  requestAnimationFrame(() => clientRef.current?.focus());
                }}
              >
                <ArrowLeft className={s.inlineIcon} aria-hidden /> Edit sample
              </button>
              <div className={s.modalAccount}>
                <Link className={`${s.button} ${s.dark}`} href="/sign-up">
                  Create your account{" "}
                  <span>
                    <ArrowUpRight className={s.icon} aria-hidden />
                  </span>
                </Link>
                <span>
                  Already have one? <Link href="/sign-in">Sign in</Link>
                </span>
              </div>
            </div>
          )}
        </div>
      </dialog>
    </PreviewContext>
  );
}

/** Any landing CTA: opens the sample dialog, titled for a plan when one is given. */
export function PreviewButton({
  plan,
  className,
  children,
}: {
  plan?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const open = use(PreviewContext);
  return (
    <button type="button" className={className} onClick={() => open(plan)}>
      {children}
    </button>
  );
}
