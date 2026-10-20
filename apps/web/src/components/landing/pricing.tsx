"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Checks } from "./checks";
import { PreviewButton } from "./preview-dialog";
import s from "./landing.module.css";

type Billing = "monthly" | "annual";

// Illustrative concept prices only; not an offer.
const FREELANCER_PRICE: Record<Billing, string> = { monthly: "500", annual: "400" };

const ANNUAL_NOTE: Record<Billing, string> = {
  monthly: "*Illustrative annual saving; yearly billing would total KSh 4,800 for Freelancer.",
  annual:
    "*Illustrative annual billing: Starter KSh 0/year; Freelancer KSh 4,800/year (KSh 400/month equivalent).",
};

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("monthly");

  const option = (value: Billing, children: React.ReactNode) => (
    <button
      type="button"
      className={billing === value ? s.active : undefined}
      aria-pressed={billing === value}
      onClick={() => setBilling(value)}
    >
      {children}
    </button>
  );

  return (
    <section className={`${s.pricing} ${s.section}`} id="pricing">
      <div className={s.wrap}>
        <div className={s.sectionHeading}>
          <div className={s.eyebrow}>ROOM TO START. SPACE TO GROW.</div>
          <h2>
            Simple plans for
            <br />
            your next big thing.
          </h2>
          <p>Illustrative pricing for this concept. Plans, limits, and prices are not final.</p>
          <div className={s.billingSwitch} role="group" aria-label="Illustrative billing interval">
            {option("monthly", "Monthly")}
            {option(
              "annual",
              <>
                Yearly <span>save 20%*</span>
              </>,
            )}
          </div>
        </div>
        <div className={s.priceGrid}>
          <article className={s.priceCard}>
            <span className={s.planLabel}>A CONFIDENT START</span>
            <h3>Starter</h3>
            <p>For getting your first invoices out.</p>
            <div className={s.price}>
              KSh <b>0</b>
              <span>/ month</span>
            </div>
            <PreviewButton plan="Starter" className={`${s.button} ${s.outline}`}>
              Explore Starter{" "}
              <span>
                <ArrowUpRight className={s.icon} aria-hidden />
              </span>
            </PreviewButton>
            <Checks
              items={[
                "Up to 5 invoices per month",
                "PDF & hosted invoice sharing",
                "Client management",
                "Manual payment recording",
              ]}
            />
          </article>
          <article className={`${s.priceCard} ${s.featured}`}>
            <span className={s.popular}>
              A LITTLE MORE ROOM <ArrowUpRight className={s.inlineIcon} aria-hidden />
            </span>
            <span className={s.planLabel}>FOR YOUR GROWING BUSINESS</span>
            <h3>Freelancer</h3>
            <p>For a steady flow of good work.</p>
            <div className={s.price}>
              KSh <b>{FREELANCER_PRICE[billing]}</b>
              <span>/ month</span>
            </div>
            <PreviewButton plan="Freelancer" className={`${s.button} ${s.dark}`}>
              Explore Freelancer{" "}
              <span>
                <ArrowUpRight className={s.icon} aria-hidden />
              </span>
            </PreviewButton>
            <Checks
              items={[
                "Unlimited invoices",
                "Everything in Starter",
                "Payment overview dashboard",
                "Reminders & follow-up organisation",
              ]}
            />
          </article>
        </div>
        <p className={s.pricingNote}>
          SAMPLE PLANS ONLY · See your account for current plans and prices.
          <br />
          <span>{ANNUAL_NOTE[billing]}</span>
        </p>
      </div>
    </section>
  );
}
