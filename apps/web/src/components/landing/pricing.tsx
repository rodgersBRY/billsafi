import { CREDIT_PACK, PRO_PLAN } from "@billsafi/domain";
import { ArrowUpRight, Crown } from "lucide-react";
import Link from "next/link";
import { FREE_FEATURES, PRO_FEATURES } from "@/lib/plan-features";
import { Checks } from "./checks";
import s from "./landing.module.css";

const proPrice = Number(PRO_PLAN.priceUsd);
const creditPrice = Number(CREDIT_PACK.priceUsd);

export function Pricing({ appOrigin = "" }: { appOrigin?: string }) {
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
            <p>For quotes, invoices and your first clients.</p>
            <div className={s.price}>
              $<b>0</b>
              <span>/ month</span>
            </div>
            <Link className={`${s.button} ${s.outline}`} href={`${appOrigin}/sign-up`}>
              Start free{" "}
              <span>
                <ArrowUpRight className={s.icon} aria-hidden />
              </span>
            </Link>
            <Checks items={FREE_FEATURES} />
          </article>
          <article className={`${s.priceCard} ${s.featured}`}>
            <span className={s.planLabel}>FOR REGULAR INVOICING</span>
            <h3>
              Pro <Crown className={`${s.icon} ${s.proCrown}`} aria-hidden />
            </h3>
            <p>For steady work and monthly retainers.</p>
            <div className={s.price}>
              $<b>{proPrice}</b>
              <span>/ month</span>
            </div>
            <Link className={`${s.button} ${s.dark}`} href={`${appOrigin}/sign-up`}>
              Get Pro{" "}
              <span>
                <ArrowUpRight className={s.icon} aria-hidden />
              </span>
            </Link>
            <Checks items={PRO_FEATURES} />
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
