import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/components/legal/legal-info";
import { ContactEmail, LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · BillSafi",
  description:
    "What personal information BillSafi collects, why, who we share it with, and your rights.",
};

const { company, product } = LEGAL;

const SECTIONS: LegalSection[] = [
  {
    id: "who",
    heading: "Who is responsible for your data",
    body: (
      <>
        <p>
          {product} is run by {company}, a company registered in Kenya. For the information about
          you and your account, we are the data controller under the Kenya Data Protection Act,
          2019. If you live in the UK or the European Economic Area, we also respect the rights you
          have under the GDPR.
        </p>
        <p>
          Your clients&apos; details are different. When you add a client and send them invoices,
          you decide what information to keep and why. You are the controller of that data, and we
          process it for you to provide the service.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    heading: "What we collect",
    body: (
      <>
        <h3>Information you give us</h3>
        <ul>
          <li>
            <strong>Account details:</strong> your name, email address and password. We store your
            password only as a secure hash, never in plain text.
          </li>
          <li>
            <strong>Business details:</strong> the business or trading name, contact email, phone
            number, address, tax ID and logo you choose to add.
          </li>
          <li>
            <strong>Payment instructions:</strong> the M-Pesa number, Till, Paybill or bank details
            you want shown on invoices.
          </li>
          <li>
            <strong>Client details:</strong> names, emails, phone numbers and addresses of the
            people and businesses you invoice.
          </li>
          <li>
            <strong>Invoices and payment records:</strong> line items, amounts, dates, notes, and
            the payments you record, including any transaction references.
          </li>
          <li>
            <strong>Messages to support:</strong> anything you send us by email.
          </li>
        </ul>

        <h3>Information from Google</h3>
        <p>
          If you sign in with Google, Google shares your name, email address and profile picture
          with us. We do not get access to your Gmail, contacts, Drive or any other Google data, and
          we do not keep Google&apos;s access tokens after you sign in.
        </p>

        <h3>Information from subscription payments</h3>
        <p>
          When you pay for Pro or invoice credits, we record the M-Pesa phone number you paid from,
          the amount, the exchange rate used, and the M-Pesa receipt number. We never see or store
          your M-Pesa PIN.
        </p>

        <h3>Information collected automatically</h3>
        <ul>
          <li>
            <strong>Sign-in sessions:</strong> the IP address and browser type for each session, so
            we can keep your account secure.
          </li>
          <li>
            <strong>Error reports:</strong> technical details when something breaks, such as the
            page you were on, your browser, and the error message.
          </li>
          <li>
            <strong>Usage counts:</strong> how many invoices each account has marked Ready, to apply
            plan limits.
          </li>
        </ul>
        <p>
          We do not use advertising trackers, and WE DO NOT SELL OR RENT YOUR DATA TO ANYONE.
        </p>
      </>
    ),
  },
  {
    id: "use",
    heading: "How we use it",
    body: (
      <>
        <p>We use your information to:</p>
        <ul>
          <li>create and secure your account and keep you signed in;</li>
          <li>build your invoices, PDFs and public invoice pages;</li>
          <li>process Pro and credit payments and apply your plan;</li>
          <li>send emails you need, such as password resets and reminders before Pro ends;</li>
          <li>find and fix bugs, and stop fraud or abuse;</li>
          <li>answer your questions and support requests;</li>
          <li>meet our legal, tax and accounting duties.</li>
        </ul>
        <p>
          We rely on these legal grounds: performing our contract with you, our legitimate interest
          in running a secure and working service, meeting legal obligations, and your consent where
          we ask for it. We do not send marketing email unless you have agreed to receive it.
        </p>
      </>
    ),
  },
  {
    id: "public",
    heading: "What your clients and the public can see",
    body: (
      <p>
        When you share an invoice by link, ANYONE WITH THE LINK CAN SEE THAT INVOICE, including your
        business details, payment instructions, and the client&apos;s details shown on it. The link
        is long and hard to guess, but IT IS NOT PASSWORD PROTECTED. You can disable it at any time.
        PDFs you download and send are outside our control once they leave {product}.
      </p>
    ),
  },
  {
    id: "share",
    heading: "Who we share it with",
    body: (
      <>
        <p>
          We share data only with service providers who help us run {product}, and only what they
          need:
        </p>
        <ul>
          <li>
            <strong>Hosting provider:</strong> stores our servers, database and backups.
          </li>
          <li>
            <strong>Payment provider (M-Pesa):</strong> processes Pro and credit payments.
          </li>
          <li>
            <strong>Sign-in provider (Google):</strong> handles sign-in if you choose
            &quot;Continue with Google&quot;.
          </li>
          <li>
            <strong>Email delivery provider:</strong> sends account and reminder emails.
          </li>
          <li>
            <strong>Error monitoring provider:</strong> collects error reports so we can fix
            problems.
          </li>
        </ul>
        <p>
          You can ask us at <ContactEmail /> for the current list of providers.
        </p>
        <p>
          We may also share information if the law requires it, to protect people from harm or
          fraud, or as part of a sale or merger of our business. In a sale, we would tell you before
          your data moves to a new owner.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    heading: "International transfers",
    body: (
      <p>
        Some of our providers store or process data outside Kenya, including in the United States
        and Europe. When data leaves Kenya, we use providers that offer appropriate safeguards, such
        as standard contractual clauses, as required by the Kenya Data Protection Act.
      </p>
    ),
  },
  {
    id: "browser",
    heading: "Cookies and browser storage",
    body: (
      <>
        <p>We keep this to what the service needs to work:</p>
        <ul>
          <li>
            <strong>Session cookie:</strong> keeps you signed in. Without it, you cannot use the
            app.
          </li>
          <li>
            <strong>Free invoice generator draft:</strong> if you use the generator before creating
            an account, your draft is saved in your own browser&apos;s storage. It does not reach us
            until you choose to save it to an account.
          </li>
          <li>
            <strong>Small preferences:</strong> things like whether prices show in USD or KES, and
            short-lived flags that last only while the tab is open.
          </li>
        </ul>
        <p>We do not use advertising or cross-site tracking cookies.</p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep it",
    body: (
      <>
        <ul>
          <li>
            <strong>Account and business data:</strong> for as long as your account is open.
          </li>
          <li>
            <strong>Issued invoices and payment records:</strong> these are financial records, so we
            do not delete them during normal use. Draft invoices can be deleted at any time.
          </li>
          <li>
            <strong>Subscription payment records:</strong> as long as tax and accounting law
            requires, which in Kenya is usually at least five years.
          </li>
          <li>
            <strong>Sign-in sessions:</strong> until they expire or you sign out.
          </li>
          <li>
            <strong>Backups:</strong> daily database backups are kept for 14 days, then overwritten.
          </li>
        </ul>
        <p>
          When you ask us to close your account, we delete or anonymise your data within 30 days,
          except records we must keep by law. Data in backups is removed as those backups expire.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "How we protect it",
    body: (
      <p>
        All traffic to {product} is encrypted with HTTPS. Passwords are hashed. Each business&apos;s
        data is kept separate, and only you can see it while signed in. Our database is not exposed
        to the internet. No system is perfectly secure, so if we learn of a breach that affects you,
        we will tell you and the Office of the Data Protection Commissioner as the law requires.
      </p>
    ),
  },
  {
    id: "rights",
    heading: "Your rights",
    body: (
      <>
        <p>You have the right to:</p>
        <ul>
          <li>be told how your data is used, which this policy does;</li>
          <li>get a copy of the personal data we hold about you;</li>
          <li>have wrong or incomplete data corrected;</li>
          <li>have your data deleted, subject to records we must keep by law;</li>
          <li>object to or limit how we use your data;</li>
          <li>receive your data in a portable format;</li>
          <li>withdraw consent where we rely on it.</li>
        </ul>
        <p>
          You can edit most of your details yourself in Settings. For anything else, email{" "}
          <ContactEmail />. We will reply within 30 days and may ask you to confirm your identity.
        </p>
        <p>
          If you are one of our users&apos; clients and want your details changed or removed, please
          contact the business that invoiced you first. We will help where we can.
        </p>
        <p>
          If you are unhappy with how we handled your data, you can complain to the Office of the
          Data Protection Commissioner in Kenya (odpc.go.ke), or to the data protection authority
          where you live.
        </p>
      </>
    ),
  },
  {
    id: "children",
    heading: "Children",
    body: (
      <p>
        {product} is for people aged 18 and over. We do not knowingly collect data from children. If
        you think a child has given us personal data, contact us and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        We will update this policy when the way we handle data changes. The date at the top shows
        the latest version. For significant changes, we will tell you in the app or by email first.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "Contact us",
    body: (
      <p>
        For privacy questions or requests, email <ContactEmail />. You can also read our{" "}
        <Link href="/terms" className="font-medium text-accent hover:underline">
          Terms of Use
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what personal information {product} collects, why we need it, who we
          share it with, and the choices you have. We collect only what we need to run the service.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
