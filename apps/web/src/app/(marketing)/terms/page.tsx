import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/components/legal/legal-info";
import { ContactEmail, LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use · BillSafi",
  description: "The rules for using BillSafi, the invoicing service run by Zubariq Ventures LTD.",
};

const { company, product } = LEGAL;

const SECTIONS: LegalSection[] = [
  {
    id: "about",
    heading: "Who we are",
    body: (
      <>
        <p>
          {product} is an online invoicing service owned and run by {company}, a company registered
          in Kenya. In these terms, &quot;we&quot;, &quot;us&quot; and &quot;our&quot; mean{" "}
          {company}. &quot;You&quot; means the person or business using {product}.
        </p>
        <p>
          By creating an account, signing in, or using any part of {product}, you agree to these
          terms. If you do not agree, please do not use the service.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    heading: "Who can use BillSafi",
    body: (
      <>
        <p>
          You must be at least 18 years old and able to enter a binding contract. If you use{" "}
          {product} on behalf of a business, you confirm that you have the authority to accept these
          terms for that business.
        </p>
      </>
    ),
  },
  {
    id: "account",
    heading: "Your account",
    body: (
      <>
        <p>
          You can sign up with an email address and password, or with Google. Give us accurate
          details and keep them up to date.
        </p>
        <ul>
          <li>Keep your password private. Do not share your account with others.</li>
          <li>You are responsible for everything done through your account.</li>
          <li>
            Tell us at <ContactEmail /> straight away if you think someone else has accessed your
            account.
          </li>
        </ul>
        <p>
          One account can hold several businesses. Each business&apos;s clients, invoices and
          payment records are kept separate from the others.
        </p>
      </>
    ),
  },
  {
    id: "service",
    heading: "What BillSafi does",
    body: (
      <>
        <p>
          {product} helps you create invoices, keep a list of your clients, share invoices as a PDF
          or a link, and record payments your clients make to you.
        </p>
        <p>
          WE DO NOT COLLECT OR HOLD MONEY ON YOUR BEHALF. Your clients pay you directly using the
          payment instructions you put on your invoices, such as an M-Pesa number, Till, Paybill or
          bank account. Any payment you record in {product} is a note you make for your own records.
          WE DO NOT CONFIRM THAT THE MONEY ARRIVED.
        </p>
        <p>
          WE ARE NOT A PARTY TO ANY AGREEMENT BETWEEN YOU AND YOUR CLIENTS. Disputes about work,
          prices, late payment or refunds are between you and your client.
        </p>
      </>
    ),
  },
  {
    id: "responsibilities",
    heading: "Your invoices and your obligations",
    body: (
      <>
        <p>You are responsible for the content of every invoice you create. That includes:</p>
        <ul>
          <li>the accuracy of amounts, dates, descriptions and payment details;</li>
          <li>charging, showing and paying any tax that applies to you, such as VAT;</li>
          <li>meeting any invoicing, record keeping or tax rules in your country.</li>
        </ul>
        <p>
          {product} calculates totals, discounts and tax from the figures you enter. IT DOES NOT
          GIVE TAX, LEGAL OR ACCOUNTING ADVICE, AND AN INVOICE MADE IN {product.toUpperCase()} IS
          NOT A GUARANTEE THAT IT MEETS THE REQUIREMENTS OF ANY TAX AUTHORITY. If you are unsure,
          speak to an accountant.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use",
    body: (
      <>
        <p>You agree not to use {product} to:</p>
        <ul>
          <li>send fake, misleading or fraudulent invoices, or ask for money you are not owed;</li>
          <li>pretend to be another person or business;</li>
          <li>break any law, including tax, consumer protection and anti-money laundering laws;</li>
          <li>
            upload content you do not have the right to use, such as someone else&apos;s logo;
          </li>
          <li>harass anyone or send content that is abusive, hateful or obscene;</li>
          <li>
            try to get into accounts or data that are not yours, probe or attack our systems, or get
            around plan limits;
          </li>
          <li>
            copy, resell or scrape the service, or use automated tools to put heavy load on it.
          </li>
        </ul>
        <p>
          We may remove content, disable public invoice links, or suspend an account that breaks
          these rules.
        </p>
      </>
    ),
  },
  {
    id: "content",
    heading: "Your content",
    body: (
      <>
        <p>
          You own the information you put into {product}: your business details, logo, client
          records, invoices and payment records. We claim no ownership over it.
        </p>
        <p>
          You give us permission to store, process, display and send that information only as needed
          to run the service for you. For example, we need it to show your invoice on a public link,
          produce a PDF, or email you a password reset.
        </p>
        <p>
          When you add a client, you confirm that you are allowed to share their details with us for
          invoicing. How we handle personal information is explained in our{" "}
          <Link href="/privacy" className="font-medium text-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: "public-links",
    heading: "Public invoice links",
    body: (
      <>
        <p>
          When you share an invoice by link, ANYONE WHO HAS THAT LINK CAN OPEN THE INVOICE WITHOUT
          SIGNING IN. Only send links to people who should see the invoice. You can turn off a link
          from the invoice&apos;s share options at any time.
        </p>
      </>
    ),
  },
  {
    id: "plans",
    heading: "Plans, payments and refunds",
    body: (
      <>
        <p>
          {product} has a Free plan and a paid Pro plan. Each plan allows a set number of invoices
          to be marked Ready each period. You can also buy invoice credit packs. Current prices and
          limits are shown on our{" "}
          <Link href="/#pricing" className="font-medium text-accent hover:underline">
            pricing section
          </Link>{" "}
          and on the Billing page in the app.
        </p>
        <ul>
          <li>
            Prices are set in US dollars. Payment is taken in Kenyan shillings through M-Pesa,
            converted at the exchange rate shown at checkout.
          </li>
          <li>
            Pro lasts one month from the confirmed payment. IT DOES NOT RENEW BY ITSELF. We send
            reminders before it ends, and you choose whether to pay again.
          </li>
          <li>
            Invoice credits do not expire and are used only after your plan allowance runs out.
          </li>
          <li>
            If Pro ends, your account moves to the Free plan. Your businesses, clients, invoices and
            payment records stay in place.
          </li>
        </ul>
        <p>
          PAYMENTS ARE NOT REFUNDABLE, except where the law requires a refund or we agree to one. If
          you were charged by mistake or paid twice, contact <ContactEmail /> and we will look into
          it.
        </p>
        <p>
          We may change prices or plan limits. A change will not affect a period you have already
          paid for, and we will give notice in the app or by email before a price rise applies to
          you.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    heading: "Availability and changes to the service",
    body: (
      <>
        <p>
          We work to keep {product} running and your data backed up, but we cannot promise the
          service will always be available or free of errors. We may need to pause it for
          maintenance, and we may add, change or remove features over time.
        </p>
        <p>
          KEEP YOUR OWN COPIES OF ANYTHING YOU MUST NOT LOSE. You can download any Ready invoice as
          a PDF.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    heading: "Our intellectual property",
    body: (
      <>
        <p>
          The {product} name, logo, design and software belong to {company}. These terms give you
          the right to use the service. They do not give you any right to our brand or code.
        </p>
        <p>
          If you send us feedback or ideas, we may use them to improve {product} without owing you
          anything.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    heading: "Closing your account",
    body: (
      <>
        <p>
          You can stop using {product} at any time. To close your account, email <ContactEmail />{" "}
          from the address you signed up with.
        </p>
        <p>
          We may suspend or close your account if you break these terms, if your use puts other
          users or the service at risk, or if the law requires it. Where it is reasonable, we will
          tell you first and give you a chance to download your invoices.
        </p>
        <p>
          Some records, such as issued invoices and payment history, may be kept after closure where
          the law requires it. Our{" "}
          <Link href="/privacy" className="font-medium text-accent hover:underline">
            Privacy Policy
          </Link>{" "}
          explains how long we keep data.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    heading: "Disclaimers",
    body: (
      <>
        <p>
          {product.toUpperCase()} IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;. TO THE
          EXTENT THE LAW ALLOWS, WE MAKE NO PROMISES THAT THE SERVICE WILL MEET YOUR NEEDS, THAT
          CALCULATIONS SUIT YOUR TAX SITUATION, OR THAT YOUR CLIENTS WILL PAY YOU.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    heading: "Limits on our liability",
    body: (
      <>
        <p>TO THE EXTENT THE LAW ALLOWS:</p>
        <ul>
          <li>
            WE ARE NOT LIABLE FOR LOST PROFITS, LOST REVENUE, LOST DATA, UNPAID INVOICES, OR ANY
            INDIRECT OR CONSEQUENTIAL LOSS;
          </li>
          <li>
            OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM IS LIMITED TO THE AMOUNT YOU PAID US IN THE 12
            MONTHS BEFORE THE CLAIM, OR USD 50 IF THAT IS HIGHER.
          </li>
        </ul>
        <p>
          Nothing in these terms limits liability for fraud, or for anything else the law does not
          allow us to limit.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    heading: "Indemnity",
    body: (
      <p>
        If someone makes a claim against us because of invoices you created, content you uploaded,
        or your breach of these terms, you agree to cover our reasonable losses and costs from that
        claim.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these terms as {product} changes. The date at the top shows the latest
        version. If a change is significant, we will tell you in the app or by email before it takes
        effect. If you keep using {product} after that, the new terms apply.
      </p>
    ),
  },
  {
    id: "law",
    heading: "Governing law and disputes",
    body: (
      <>
        <p>
          These terms are governed by the laws of Kenya. If a dispute comes up, contact us first and
          we will try to settle it informally. If that fails, the courts of Kenya will decide it.
        </p>
        <p>If any part of these terms is found to be unenforceable, the rest still applies.</p>
      </>
    ),
  },
  {
    id: "contact",
    heading: "Contact us",
    body: (
      <p>
        Questions about these terms can go to <ContactEmail />.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={
        <p>
          These terms explain the rules for using {product}. Please read them before you create an
          account. They are written to be read, so get in touch if anything is unclear.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
