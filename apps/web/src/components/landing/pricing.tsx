import { CREDIT_PACK, FREE_PLAN, PRO_PLAN } from "@billsafi/domain";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Checks } from "./checks";
import s from "./landing.module.css";

const proPrice = Number(PRO_PLAN.priceUsd);
const creditPrice = Number(CREDIT_PACK.priceUsd);

export function Pricing() {
  return (
    <section className={`${s.pricing} ${s.section}`} id="pricing">
      <div className={s.wrap}>
        <div className={s.sectionHeading}>
          <div className={s.eyebrow}>PRICING</div>
          <h2>Start free. Upgrade when you’re busy.</h2>
          <p>Two plans, billed monthly. Prices are in US dollars.</p>
        </div>
        <div className={s.priceGrid}>
          <article className={s.priceCard}>
            <span className={s.planLabel}>FOR GETTING STARTED</span>
            <h3>Free</h3>
            <p>For your first clients.</p>
            <div className={s.price}>
              $<b>0</b>
              <span>/ month</span>
            </div>
            <Link className={`${s.button} ${s.outline}`} href="/sign-up">
              Start free{" "}
              <span>
                <ArrowUpRight className={s.icon} aria-hidden />
              </span>
            </Link>
            <Checks
              items={[
                `${FREE_PLAN.invoiceLimit} invoices a month`,
                "PDF and link sharing",
                "Client details saved",
                "Payment tracking",
              ]}
            />
          </article>
          <article className={`${s.priceCard} ${s.featured}`}>
            <span className={s.planLabel}>FOR REGULAR INVOICING</span>
            <h3>Pro</h3>
            <p>For a steady flow of work.</p>
            <div className={s.price}>
              $<b>{proPrice}</b>
              <span>/ month</span>
            </div>
            <Link className={`${s.button} ${s.dark}`} href="/sign-up">
              Get Pro{" "}
              <span>
                <ArrowUpRight className={s.icon} aria-hidden />
              </span>
            </Link>
            <Checks
              items={[
                `${PRO_PLAN.invoiceLimit} invoices a month`,
                "Everything in Free",
                "One plan covers all your businesses",
                "No automatic charges",
              ]}
            />
          </article>
        </div>
        <p className={s.pricingNote}>
          Need more in a busy month? Add {CREDIT_PACK.invoices} invoices for ${creditPrice}. Extra
          invoices don’t expire.
          <br />
          <span>Pro is currently paid through M-Pesa, charged at the day’s exchange rate.</span>
        </p>
      </div>
    </section>
  );
}
