import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Asterisk,
  Bell,
  Check,
  ChevronDown,
  Clock,
  FileText,
  LayoutGrid,
  Play,
  Plus,
  ReceiptText,
  Sparkle,
  Users,
} from "lucide-react";
import { DM_Sans, Manrope } from "next/font/google";
import Link from "next/link";
import { Fragment } from "react";
import { Checks } from "./checks";
import { Pricing } from "./pricing";
import { PreviewButton, PreviewProvider } from "./preview-dialog";
import { SiteHeader } from "./site-header";
import { Wordmark } from "./wordmark";
import s from "./landing.module.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

const AUDIENCE = ["Designers", "Developers", "Consultants", "Creatives"];

const STEPS = [
  {
    title: "Make it yours",
    body: "Add your business details and client. A professional first impression starts here.",
  },
  {
    title: "Send it off",
    body: "List your services and payment instructions, then share your PDF or invoice link.",
  },
  {
    title: "Keep it all clear",
    body: "Record payments, check balances, and use reminders to stay on top of what’s due.",
  },
];

const FAQS = [
  {
    question: "Who is BillSafi for?",
    answer:
      "BillSafi is designed for Kenyan freelancers, consultants, and independent service providers who want a simple way to create invoices, organise clients, and track money owed.",
  },
  {
    question: "Can my clients pay through M-Pesa?",
    answer:
      "You can include M-Pesa payment instructions on an invoice. Your client pays you directly outside BillSafi, and you manually record the payment. V1 has no integrated M-Pesa checkout, automatic verification, or reconciliation.",
  },
  {
    question: "Can I record a deposit or a partial payment?",
    answer:
      "Yes. Manually record the amount received against an invoice. BillSafi tracks the remaining balance so you can see what is still outstanding.",
  },
  {
    question: "How do I share an invoice?",
    answer:
      "V1 supports PDF invoices and hosted invoice links. Download and share a PDF, or send the hosted link using your preferred communication channel.",
  },
  {
    question: "Does BillSafi replace tax or accounting software?",
    answer:
      "This concept focuses on invoicing and payment tracking. It does not promise tax filing, eTIMS integration, or full accounting features.",
  },
  {
    question: "Can I sign up today?",
    answer:
      "Yes. Create a free account to send your first invoices, or sign in if you already have one. The product screens and plans on this page are examples, so check your account for current limits and prices.",
  },
];

/** Arrow that trails button labels, sized like the reference's ↗ glyph. */
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
          <span className={s.liveDot} /> BUILT FOR THE WAY YOU WORK
        </div>
        <h1>
          Good work.
          <br />
          Great invoices.
          <br />
          <em>All safi.</em>
        </h1>
        <p>
          You do the work. We’ll help with the paperwork.
          <br className={s.desktop} /> Create professional invoices, keep track of payments, and get
          back to what you do best.
        </p>
        <div className={s.heroActions}>
          <Link className={`${s.button} ${s.dark}`} href="/sign-up">
            Create your first invoice <Trail />
          </Link>
          <PreviewButton className={s.textButton}>
            <span className={s.play}>
              <Play aria-hidden />
            </span>{" "}
            Take a look inside
          </PreviewButton>
        </div>
        <div className={s.heroNote}>
          <span>
            <Check className={s.inlineIcon} aria-hidden /> Made for Kenyan freelancers
          </span>
          <span>
            <Check className={s.inlineIcon} aria-hidden /> Simple from day one
          </span>
        </div>
        <p className={s.returning}>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>

      <div className={s.heroVisual}>
        <div className={s.visualGrid} />
        <div className={s.visualLabel}>
          <span>YOUR BUSINESS, LOOKING THE PART.</span>
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
                <strong>KSh 128,500</strong>
                <span className={s.mintText}>
                  <span className={s.statusDot} />
                  Payments recorded
                </span>
              </div>
              <div>
                <small>Outstanding</small>
                <strong>KSh 42,000</strong>
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
              <b>KSh 35,000</b>
              <span className={`${s.badge} ${s.paid}`}>Paid</span>
            </div>
            <div className={s.invoiceRow}>
              <span>
                <b>Karibu Coffee</b>
                <small>INV-023 · Content design</small>
              </span>
              <b>KSh 24,000</b>
              <span className={`${s.badge} ${s.partial}`}>Partial</span>
            </div>
            <div className={s.invoiceRow}>
              <span>
                <b>Mawimbi Creative</b>
                <small>INV-022 · Website design</small>
              </span>
              <b>KSh 18,000</b>
              <span className={`${s.badge} ${s.pending}`}>Sent</span>
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
            <small>FROM AMANI NJERI</small>
            <h4>
              Good design.
              <br />
              Great partnership.
            </h4>
          </div>
          <div className={s.paperLine}>
            <span>Brand identity design</span>
            <b>KSh 35,000</b>
          </div>
          <div className={s.paperTotal}>
            <span>Total</span>
            <strong>KSh 35,000</strong>
          </div>
          <div className={s.paperFooter}>
            <Check className={s.inlineIcon} aria-hidden /> Professional. And ready to share.
          </div>
        </div>
        <div className={s.paymentToast}>
          <span className={s.toastIcon}>
            <Check aria-hidden />
          </span>
          <div>
            <b>A little less admin. A lot more clarity.</b>
            <small>Your work, beautifully organised.</small>
          </div>
        </div>
        <span className={s.demoLabel}>ILLUSTRATIVE PRODUCT PREVIEW · SAMPLE DATA</span>
      </div>
    </section>
  );
}

function Audience() {
  return (
    <section className={`${s.audience} ${s.wrap}`}>
      <p>
        FOR THE INDEPENDENT MINDS
        <br />
        <strong>building something of their own.</strong>
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
        <div className={s.eyebrow}>LESS ADMIN. MORE POSSIBILITY.</div>
        <h2>
          Your talent is your business.
          <br />
          Let’s keep it that way.
        </h2>
        <p>
          From the first invoice to the final payment,
          <br />
          give your business a little more breathing room.
        </p>
      </div>
      <div className={s.benefitGrid}>
        <article>
          <span className={s.featureIcon}>
            <ArrowUpRight className={s.icon} aria-hidden />
          </span>
          <h3>Look as good as your work</h3>
          <p>Send clear, professional invoices that give clients every detail they need.</p>
        </article>
        <article>
          <span className={s.featureIcon}>
            <Clock className={s.icon} aria-hidden />
          </span>
          <h3>Know where you stand</h3>
          <p>See what’s paid, what’s partially paid, and what still needs a follow-up.</p>
        </article>
        <article>
          <span className={s.featureIcon}>
            <Asterisk className={s.icon} aria-hidden />
          </span>
          <h3>Keep your head in the work</h3>
          <p>Bring invoices, client details, and reminders together in one calm place.</p>
        </article>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className={`${s.features} ${s.section} ${s.wrap}`} id="features">
      <div className={s.featureBlock}>
        <div className={s.featureArt}>
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
                <span>Designer · Nairobi, Kenya</span>
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
              <b>KSh 24,000</b>
            </div>
            <div className={s.sheetTotal}>
              Total due <strong>KSh 24,000</strong>
            </div>
            <div className={s.instructions}>
              <b>Payment instructions</b>
              <p>
                M-Pesa · Send Money
                <br />
                Use the phone number provided by your freelancer.
                <br />
                Reference: INV-025
              </p>
            </div>
            <span className={s.sheetThanks}>Thank you for supporting independent work.</span>
          </div>
          <div className={s.shareChip}>
            <ArrowUpRight className={s.inlineIcon} aria-hidden /> <b>PDF or a link. Your choice.</b>
          </div>
        </div>
        <div className={s.featureCopy}>
          <div className={s.eyebrow}>01 / MAKE IT OFFICIAL</div>
          <h2>
            From “I’ll send an invoice”
            <br />
            to <em>already sent.</em>
          </h2>
          <p>
            Add your client, list your work, and set a due date. Share a polished PDF or a hosted
            invoice link, ready for your client to view.
          </p>
          <Checks
            items={[
              "Clear line items, totals, and due dates",
              "Client details saved for next time",
              "Your payment instructions, right on the invoice",
            ]}
          />
          <PreviewButton className={s.linkButton}>
            Explore a sample invoice{" "}
            <span>
              <ArrowUpRight className={s.inlineIcon} aria-hidden />
            </span>
          </PreviewButton>
        </div>
      </div>

      <div className={`${s.featureBlock} ${s.reverse}`}>
        <div className={`${s.featureArt} ${s.trackingArt}`}>
          <div className={s.trackingCard}>
            <div className={s.trackingTitle}>
              <span className={s.featureIcon}>
                <ReceiptText className={s.icon} aria-hidden />
              </span>
              <div>
                <small>INVOICE INV-023</small>
                <h3>Every payment. Accounted for.</h3>
              </div>
            </div>
            <div className={s.balance}>
              <small>Remaining balance</small>
              <strong>
                KSh 12,000<span>.00</span>
              </strong>
              <div className={s.progress}>
                <span />
              </div>
              <div className={s.balanceCaption}>
                <span>KSh 12,000 received</span>
                <span>KSh 24,000 total</span>
              </div>
            </div>
            <div className={s.record}>
              <span className={s.recordCheck}>
                <Check className={s.inlineIcon} aria-hidden />
              </span>
              <div>
                <b>Payment recorded</b>
                <small>16 Oct 2026 · M-Pesa · Added manually</small>
              </div>
              <strong>+ KSh 12,000</strong>
            </div>
            <div className={s.reminder}>
              <Bell className={s.inlineIcon} aria-hidden />{" "}
              <span>Next up: a friendly reminder</span>
              <ArrowUpRight className={s.inlineIcon} aria-hidden />
            </div>
          </div>
          <span className={s.artNote}>A clearer picture. Without the spreadsheet.</span>
        </div>
        <div className={s.featureCopy}>
          <div className={s.eyebrow}>02 / STAY IN THE KNOW</div>
          <h2>
            Less “have they paid?”
            <br />
            More <em>peace of mind.</em>
          </h2>
          <p>
            Record full or partial payments as they come in. Your dashboard keeps the balance clear,
            so you know who needs a reminder and who’s all settled.
          </p>
          <Checks
            items={[
              "Record payments received outside BillSafi",
              "Track outstanding amounts at a glance",
              "Keep on top of follow-ups with reminders",
            ]}
          />
          <div className={s.honestNote}>
            <b>You receive it. You record it.</b> BillSafi V1 does not process payments or
            automatically verify M-Pesa transactions.
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
          <div className={s.eyebrow}>A SMALL ROUTINE. A BIG DIFFERENCE.</div>
          <h2>
            From done to invoiced.
            <br />
            In three simple steps.
          </h2>
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

function Kenya() {
  return (
    <section className={`${s.kenya} ${s.section} ${s.wrap}`}>
      <div className={s.kenyaCopy}>
        <div className={s.eyebrow}>ROOTED HERE. READY FOR YOUR NEXT CHAPTER.</div>
        <h2>
          Built for your hustle.
          <br />
          <em>Right here in Kenya.</em>
        </h2>
        <p>
          For the Nairobi designer, the Mombasa developer, and the consultant building from
          anywhere. BillSafi puts the everyday details of independent work in one place.
        </p>
        <div className={s.localPoints}>
          <span>
            <b>KSh</b> Kenyan shilling invoices
          </span>
          <span>
            <b>
              <ArrowUpRight className={s.inlineIcon} aria-hidden />
            </b>{" "}
            M-Pesa & bank instructions
          </span>
          <span>
            <b>
              <Users className={s.inlineIcon} aria-hidden />
            </b>{" "}
            Your clients, organised
          </span>
        </div>
        <p className={s.fineprint}>
          Include your preferred payment details. Clients pay you directly through your chosen
          channel; you record the payment in BillSafi.
        </p>
      </div>
      <div className={s.kenyaArt}>
        <div className={s.orbit} />
        <div className={`${s.orbit} ${s.orbitTwo}`} />
        <Asterisk className={`${s.star} ${s.starOne}`} aria-hidden />
        <Sparkle className={`${s.star} ${s.starTwo}`} aria-hidden />
        <div className={s.localCard}>
          <span className={s.localTag}>INDEPENDENT & IN GOOD COMPANY</span>
          <div className={s.localBig}>
            Made of
            <br />
            good <em>work.</em>
          </div>
          <div className={s.localBottom}>
            <span>NAIROBI · KENYA</span>
            <span>01°17′S 36°49′E</span>
          </div>
        </div>
        <div className={s.kenyaSticker}>
          A little more
          <b>safi.</b>
          <ArrowUpRight className={s.inlineIcon} aria-hidden />
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className={`${s.faq} ${s.section} ${s.wrap}`} id="faq">
      <div className={s.faqIntro}>
        <div className={s.eyebrow}>A FEW THINGS, CLEARED UP.</div>
        <h2>
          Good questions.
          <br />
          Straight answers.
        </h2>
        <p>
          Getting the admin out of the way
          <br />
          starts with knowing what to expect.
        </p>
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
      <div className={s.eyebrow}>YOUR NEXT CHAPTER LOOKS GOOD.</div>
      <h2>
        Big on your craft.
        <br />
        <em>Light on the admin.</em>
      </h2>
      <p>Give your good work the invoice it deserves.</p>
      <Link className={`${s.button} ${s.dark}`} href="/sign-up">
        Create your free account <Trail />
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
        <a className={s.logo} href="#">
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
        <span>© 2026 BillSafi · A product concept made for Kenya.</span>
        <span>Visual review preview · All product data is illustrative.</span>
        <a href="#">
          Back to top <ArrowUp className={s.inlineIcon} aria-hidden />
        </a>
      </div>
    </footer>
  );
}

/** The BillSafi marketing concept: sample data and illustrative pricing only. */
export function LandingPage() {
  return (
    <div className={`${s.page} ${manrope.variable} ${dmSans.variable}`} data-landing>
      <PreviewProvider>
        <SiteHeader />
        <main>
          <Hero />
          <Audience />
          <Benefits />
          <Features />
          <Workflow />
          <Kenya />
          <Pricing />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </PreviewProvider>
    </div>
  );
}
