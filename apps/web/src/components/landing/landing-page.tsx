import { CREDIT_PACK, FREE_PLAN, PRO_PLAN } from "@billsafi/domain";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Asterisk,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  FileText,
  LayoutGrid,
  Plus,
  ReceiptText,
  Sparkle,
  Users,
} from "lucide-react";
import { Manrope } from "next/font/google";
import Link from "next/link";
import { Fragment } from "react";
import { Checks } from "./checks";
import { Pricing } from "./pricing";
import { SiteHeader } from "./site-header";
import { Wordmark } from "./wordmark";
import s from "./landing.module.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

const AUDIENCE = ["Designers", "Developers", "Consultants", "Creatives"];

const STEPS = [
  {
    title: "Set up your business",
    body: "Add your business details and payment instructions once. Every invoice uses them.",
  },
  {
    title: "Create and share",
    body: "Add your client and your services, then send a PDF or a link to the invoice.",
  },
  {
    title: "Record payments",
    body: "Log payments as they arrive and see what’s still owed and what’s overdue.",
  },
];

const FAQS = [
  {
    question: "Who is BillSafi for?",
    answer:
      "Freelancers, consultants, and independent service providers who want a simple way to create invoices, keep client details in one place, and track what they’re owed.",
  },
  {
    question: "How do my clients pay me?",
    answer:
      "Add your bank or M-Pesa details and they appear on every invoice. Your client pays you directly, then you record the payment in BillSafi. BillSafi doesn’t collect client payments or check transactions for you.",
  },
  {
    question: "Can I record a deposit or a partial payment?",
    answer:
      "Yes. Record the amount you received against the invoice and BillSafi keeps track of the balance still owed.",
  },
  {
    question: "How do I share an invoice?",
    answer:
      "Download it as a PDF, or copy a link to the online version and send it however you like, by email, WhatsApp, or text.",
  },
  {
    question: "Does BillSafi replace tax or accounting software?",
    answer:
      "No. BillSafi covers invoicing and payment tracking. It doesn’t file taxes or replace your accounting software.",
  },
  {
    question: "What does Pro cost?",
    answer: `USD ${Number(PRO_PLAN.priceUsd)} a month for ${PRO_PLAN.invoiceLimit} invoices. If you need more in a busy month, add ${CREDIT_PACK.invoices} invoices for USD ${Number(CREDIT_PACK.priceUsd)}. Extra invoices don’t expire. Pro is currently paid through M-Pesa.`,
  },
  {
    question: "Can I sign up today?",
    answer: `Yes. The Free plan includes ${FREE_PLAN.invoiceLimit} invoices a month and doesn’t ask for payment details.`,
  },
];

/** Arrow that trails button labels. */
function Trail() {
  return (
    <span>
      <ArrowUpRight className={s.icon} aria-hidden />
    </span>
  );
}

function Hero() {
  return (
    <section className={`${s.hero} ${s.wrap}`}>
      <div className={s.heroCopy}>
        <div className={s.eyebrow}>
          <span className={s.liveDot} /> INVOICING FOR FREELANCERS
        </div>
        <h1>
          Good work.
          <br />
          Great invoices.
          <br />
          <em>All safi.</em>
        </h1>
        <p>
          Create professional invoices, share them as a PDF or a link, and see who has paid and who
          still owes you.
        </p>
        <div className={s.heroActions}>
          <Link className={`${s.button} ${s.dark}`} href="/free-invoice-generator">
            Create an invoice free <Trail />
          </Link>
          <Link className={s.textButton} href="/sign-up">
            Create an account
          </Link>
        </div>
        <div className={s.heroNote}>
          <span>
            <Check className={s.inlineIcon} aria-hidden /> Free for {FREE_PLAN.invoiceLimit}{" "}
            invoices a month
          </span>
          <span>
            <Check className={s.inlineIcon} aria-hidden /> No payment details to start
          </span>
        </div>
        <p className={s.returning}>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>

      <div
        className={s.heroVisual}
        role="img"
        aria-label="The BillSafi dashboard showing money received, money outstanding, and recent invoices"
      >
        <div className={s.visualGrid} />
        <div className={s.visualLabel}>
          <span>YOUR DASHBOARD</span>
          <ArrowDownLeft aria-hidden />
        </div>
        <div className={s.dashboard}>
          <aside className={s.dashSide}>
            <div className={s.miniLogo}>
              b<span>·</span>
            </div>
            <div className={`${s.sideItem} ${s.selected}`}>
              <LayoutGrid className={s.icon} aria-hidden />
            </div>
            <div className={s.sideItem}>
              <FileText className={s.icon} aria-hidden />
            </div>
            <div className={s.sideItem}>
              <Users className={s.icon} aria-hidden />
            </div>
            <div className={s.sideBottom}>AN</div>
          </aside>
          <div className={s.dashContent}>
            <div className={s.dashTop}>
              <span>
                Overview{" "}
                <small>
                  <ChevronDown className={s.inlineIcon} aria-hidden />
                </small>
              </span>
              <span className={s.avatar}>AN</span>
            </div>
            <div className={s.dashHeading}>
              <div>
                <small>MONDAY, 19 OCTOBER</small>
                <h3>
                  Looking good, Amani <Sparkle className={s.inlineIcon} aria-hidden />
                </h3>
              </div>
              <span className={s.tinyBtn}>
                <Plus className={s.inlineIcon} aria-hidden /> New invoice
              </span>
            </div>
            <div className={s.stats}>
              <div>
                <small>Received this month</small>
                <strong>$3,480</strong>
                <span className={s.mintText}>
                  <span className={s.statusDot} />
                  Payments recorded
                </span>
              </div>
              <div>
                <small>Outstanding</small>
                <strong>$1,120</strong>
                <span>Across 3 invoices</span>
              </div>
            </div>
            <div className={s.tableHeading}>
              <b>Recent invoices</b>
              <span>
                View all <ArrowUpRight className={s.inlineIcon} aria-hidden />
              </span>
            </div>
            <div className={`${s.invoiceRow} ${s.rowHead}`}>
              <span>CLIENT / INVOICE</span>
              <span>AMOUNT</span>
              <span>STATUS</span>
            </div>
            <div className={s.invoiceRow}>
              <span>
                <b>Studio Nia</b>
                <small>INV-024 · Brand identity</small>
              </span>
              <b>$950</b>
              <span className={`${s.badge} ${s.paid}`}>Paid</span>
            </div>
            <div className={s.invoiceRow}>
              <span>
                <b>Karibu Coffee</b>
                <small>INV-023 · Content design</small>
              </span>
              <b>$640</b>
              <span className={`${s.badge} ${s.partial}`}>Partial</span>
            </div>
            <div className={s.invoiceRow}>
              <span>
                <b>Mawimbi Creative</b>
                <small>INV-022 · Website design</small>
              </span>
              <b>$480</b>
              <span className={`${s.badge} ${s.pending}`}>Ready</span>
            </div>
          </div>
        </div>

        <div className={s.floatingInvoice}>
          <div className={s.paperTop}>
            <span className={s.paperMark}>a.</span>
            <span>
              INVOICE
              <br />
              <b>INV-024</b>
            </span>
          </div>
          <div className={s.paperClient}>
            <small>BILL TO</small>
            <h4>Studio Nia</h4>
          </div>
          <div className={s.paperLine}>
            <span>Brand identity design</span>
            <b>$950</b>
          </div>
          <div className={s.paperTotal}>
            <span>Total</span>
            <strong>$950.00</strong>
          </div>
          <div className={s.paperFooter}>
            <CalendarClock className={s.inlineIcon} aria-hidden /> Due 30 Oct 2026
          </div>
        </div>
        <div className={s.paymentToast}>
          <span className={s.toastIcon}>
            <Check aria-hidden />
          </span>
          <div>
            <b>Payment recorded</b>
            <small>$950 from Studio Nia</small>
          </div>
        </div>
      </div>
    </section>
  );
}

function Audience() {
  return (
    <section className={`${s.audience} ${s.wrap}`}>
      <p>
        MADE FOR
        <br />
        <strong>independent professionals.</strong>
      </p>
      <div className={s.audienceList}>
        {AUDIENCE.map((name, index) => (
          <Fragment key={name}>
            {index > 0 && <Asterisk aria-hidden />}
            <span>{name}</span>
          </Fragment>
        ))}
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className={`${s.benefits} ${s.section} ${s.wrap}`}>
      <div className={s.sectionHeading}>
        <div className={s.eyebrow}>WHY BILLSAFI</div>
        <h2>Less admin, more paid work.</h2>
        <p>
          Your invoices, clients, and payments in one place, so you always know what you’re owed.
        </p>
      </div>
      <div className={s.benefitGrid}>
        <article>
          <span className={s.featureIcon}>
            <FileText className={s.icon} aria-hidden />
          </span>
          <h3>Professional invoices</h3>
          <p>
            Your details, line items, totals, due date, and payment instructions on every invoice.
          </p>
        </article>
        <article>
          <span className={s.featureIcon}>
            <Clock className={s.icon} aria-hidden />
          </span>
          <h3>See who owes you</h3>
          <p>Spot paid, partly paid, and overdue invoices at a glance.</p>
        </article>
        <article>
          <span className={s.featureIcon}>
            <Users className={s.icon} aria-hidden />
          </span>
          <h3>Everything in one place</h3>
          <p>
            Invoices, client details, and payments sit together, even across more than one business.
          </p>
        </article>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className={`${s.features} ${s.section} ${s.wrap}`} id="features">
      <div className={s.featureBlock}>
        <div
          className={s.featureArt}
          role="img"
          aria-label="A sample invoice with line items, a total, and bank transfer instructions"
        >
          <div className={s.invoiceSheet}>
            <div className={s.sheetHeading}>
              <span className={s.paperMark}>a.</span>
              <span>
                INVOICE <b>INV-025</b>
              </span>
            </div>
            <div className={s.sheetAddress}>
              <div>
                <small>FROM</small>
                <b>Amani Njeri</b>
                <span>Brand &amp; content designer</span>
              </div>
              <div>
                <small>BILL TO</small>
                <b>Karibu Coffee</b>
                <span>hello@example.com</span>
              </div>
            </div>
            <div className={s.sheetTable}>
              <span>DESCRIPTION</span>
              <span>AMOUNT</span>
              <b>Social content design</b>
              <b>$640</b>
            </div>
            <div className={s.sheetTotal}>
              Total due <strong>$640.00</strong>
            </div>
            <div className={s.instructions}>
              <b>Payment instructions</b>
              <p>
                Bank transfer
                <br />
                Account name: Amani Njeri
                <br />
                Reference: INV-025
              </p>
            </div>
            <span className={s.sheetThanks}>Thank you for your business.</span>
          </div>
          <div className={s.shareChip}>
            <ArrowUpRight className={s.inlineIcon} aria-hidden /> <b>PDF or a link. Your choice.</b>
          </div>
        </div>
        <div className={s.featureCopy}>
          <div className={s.eyebrow}>01 / INVOICES</div>
          <h2>
            “I’ll send an invoice”
            <br />
            becomes <em>already sent.</em>
          </h2>
          <p>
            Add your client, list your work, and set a due date. Share a polished PDF or a link to
            the invoice online.
          </p>
          <Checks
            items={[
              "Clear line items, totals, and due dates",
              "Client details saved for next time",
              "Bank or M-Pesa details right on the invoice",
            ]}
          />
          <Link className={s.linkButton} href="/free-invoice-generator">
            Try the free invoice generator{" "}
            <span>
              <ArrowUpRight className={s.inlineIcon} aria-hidden />
            </span>
          </Link>
        </div>
      </div>

      <div className={`${s.featureBlock} ${s.reverse}`}>
        <div
          className={`${s.featureArt} ${s.trackingArt}`}
          role="img"
          aria-label="An invoice with a partial payment recorded and the remaining balance"
        >
          <div className={s.trackingCard}>
            <div className={s.trackingTitle}>
              <span className={s.featureIcon}>
                <ReceiptText className={s.icon} aria-hidden />
              </span>
              <div>
                <small>INVOICE INV-023</small>
                <h3>Karibu Coffee</h3>
              </div>
            </div>
            <div className={s.balance}>
              <small>Remaining balance</small>
              <strong>
                $320<span>.00</span>
              </strong>
              <div className={s.progress}>
                <span />
              </div>
              <div className={s.balanceCaption}>
                <span>$320 received</span>
                <span>$640 total</span>
              </div>
            </div>
            <div className={s.record}>
              <span className={s.recordCheck}>
                <Check className={s.inlineIcon} aria-hidden />
              </span>
              <div>
                <b>Payment recorded</b>
                <small>16 Oct 2026 · Bank transfer · Added manually</small>
              </div>
              <strong>+ $320</strong>
            </div>
            <div className={s.reminder}>
              <CalendarClock className={s.inlineIcon} aria-hidden />{" "}
              <span>Balance due 30 Oct 2026</span>
              <ArrowUpRight className={s.inlineIcon} aria-hidden />
            </div>
          </div>
        </div>
        <div className={s.featureCopy}>
          <div className={s.eyebrow}>02 / PAYMENTS</div>
          <h2>
            Less “have they paid?”
            <br />
            More <em>peace of mind.</em>
          </h2>
          <p>
            Record full or partial payments as they come in. Your dashboard keeps the balance up to
            date, so you can see who is settled and who needs a nudge.
          </p>
          <Checks
            items={[
              "Record payments you receive outside BillSafi",
              "See outstanding balances at a glance",
              "Spot overdue invoices before they slip",
            ]}
          />
          <div className={s.honestNote}>
            <b>You receive it. You record it.</b> Clients pay you directly. BillSafi doesn’t process
            payments or check transactions for you.
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section className={`${s.workflow} ${s.section}`} id="how-it-works">
      <div className={s.wrap}>
        <div className={s.sectionHeading}>
          <div className={s.eyebrow}>HOW IT WORKS</div>
          <h2>Invoice a client in three steps.</h2>
        </div>
        <div className={s.steps}>
          {STEPS.map((step, index) => (
            <article key={step.title}>
              <span className={s.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {index < STEPS.length - 1 && <ArrowRight className={s.stepArrow} aria-hidden />}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className={`${s.faq} ${s.section} ${s.wrap}`} id="faq">
      <div className={s.faqIntro}>
        <div className={s.eyebrow}>FAQ</div>
        <h2>Questions, answered.</h2>
        <p>What BillSafi does today, and what it doesn’t do yet.</p>
      </div>
      <div className={s.faqList}>
        {FAQS.map((faq, index) => (
          <details key={faq.question} open={index === 0}>
            <summary>
              {faq.question}
              <Plus aria-hidden />
            </summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={`${s.finalCta} ${s.wrap}`}>
      <Asterisk className={s.ctaSpark} aria-hidden />
      <h2>
        Big on your craft.
        <br />
        <em>Light on the admin.</em>
      </h2>
      <p>Give your good work the invoice it deserves.</p>
      <Link className={`${s.button} ${s.dark}`} href="/free-invoice-generator">
        Create an invoice free <Trail />
      </Link>
      <small>
        Already with us? <Link href="/sign-in">Sign in</Link>
      </small>
    </section>
  );
}

function Footer() {
  return (
    <footer className={`${s.footer} ${s.wrap}`}>
      <div className={s.footerTop}>
        <a className={s.logo} href="#" aria-label="BillSafi, back to top">
          <Wordmark />
        </a>
        <p>Good work. Clear invoices. All safi.</p>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#faq">FAQs</a>
        <Link href="/sign-in">Sign in</Link>
        <Link href="/sign-up">Create account</Link>
      </div>
      <div className={s.footerBottom}>
        <span>© 2026 BillSafi · Invoicing for independent professionals.</span>
        <a href="#">
          Back to top <ArrowUp className={s.inlineIcon} aria-hidden />
        </a>
      </div>
    </footer>
  );
}

/** The BillSafi marketing page. Product previews use sample data. */
export function LandingPage() {
  return (
    <div className={`${s.page} ${manrope.variable}`} data-landing>
      <SiteHeader />
      <main>
        <Hero />
        <Audience />
        <Benefits />
        <Features />
        <Workflow />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
