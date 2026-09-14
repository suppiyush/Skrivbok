/**
 * The words of the public policy pages.
 *
 * Written from what Skrivbok actually does — how sign-in works, what is
 * stored, which services receive what, how payments and PRO periods work —
 * because a payment provider reviews these pages against the product, and a
 * policy that describes a different product (AI tools, credits, automatic
 * renewal) is a reason to be turned down.
 *
 * Facts only the business can supply — its legal name as registered with the
 * payment provider, address, phone, support inbox and the city whose courts
 * hear disputes — live in `BUSINESS` below. Until each is filled in, the pages
 * show a highlighted "[to be filled]" marker in its place rather than a guess.
 *
 * The page around this is `Legal.tsx`.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Select, Textarea } from '../../components/ui/Form';
import { Icon } from '../../components/ui/Icon';

/* ── The business ─────────────────────────────────────────────────────────── */

/**
 * Fill these in exactly as they appear on the Razorpay account (KYC). A
 * reviewer compares them; a mismatch between the site and the application is
 * one of the commonest reasons for rejection.
 */
const BUSINESS = {
  /** The name on the KYC: the proprietor's name, or the registered company/LLP. */
  legalName: null as string | null,
  /** The operating address, in full, with PIN code. */
  address: null as string | null,
  /** A phone number customers can reach. */
  phone: null as string | null,
  /** An inbox someone reads. Used on every page and by the contact form. */
  email: null as string | null,
  /** The city and state whose courts hear disputes, e.g. "Jaipur, Rajasthan". */
  jurisdiction: null as string | null,
  /** The Grievance Officer's name, required under Indian IT and data protection rules. */
  grievanceOfficer: null as string | null,
};

/** PRO prices, as charged at checkout (server defaults: PRICE_MONTHLY_PAISE / PRICE_YEARLY_PAISE). */
const PRICES = { monthly: '₹499', yearly: '₹4,999' };

/** The free plan's caps (server defaults: FREE_LIMIT_*). */
const FREE_LIMIT = 5;

const UPDATED = 'Last updated: 14 September 2026';

/* ── Type ─────────────────────────────────────────────────────────────────── */

function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-10 border-b border-line pb-2 text-[20px] leading-snug font-bold tracking-[-0.01em] text-ink first:mt-0">
      {children}
    </h2>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 text-[16px] font-semibold text-ink">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[15px] leading-[1.8] text-ink-3 first:mt-0">{children}</p>;
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-4 flex list-disc flex-col gap-2 pl-6 text-[15px] leading-[1.8] text-ink-3 marker:text-ink-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

function To({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-brand-ink underline underline-offset-2">
      {children}
    </Link>
  );
}

/** A business fact, or a marker that it is still missing. */
function Fill({ value, what }: { value: string | null; what: string }) {
  if (value) return <>{value}</>;
  return (
    <mark
      className="rounded px-1 font-semibold not-italic"
      style={{ background: '#fff3bf', color: '#7a4d00' }}
    >
      [to be filled: {what}]
    </mark>
  );
}

function Operator() {
  return <Fill value={BUSINESS.legalName} what="legal business name" />;
}

function SupportEmail() {
  return BUSINESS.email ? (
    <a
      href={`mailto:${BUSINESS.email}`}
      className="font-semibold text-brand-ink underline underline-offset-2"
    >
      {BUSINESS.email}
    </a>
  ) : (
    <Fill value={null} what="support email" />
  );
}

/** The same contact block at the foot of every document. */
function ContactBlock() {
  return (
    <P>
      <B>Operator:</B> <Operator />
      <br />
      <B>Email:</B> <SupportEmail />
      <br />
      <B>Phone:</B> <Fill value={BUSINESS.phone} what="phone number" />
      <br />
      <B>Address:</B> <Fill value={BUSINESS.address} what="operating address" />
    </P>
  );
}

/* ── Terms and Conditions ─────────────────────────────────────────────────── */

function Terms() {
  return (
    <>
      <P>
        These Terms and Conditions (“Terms”) are an agreement between you and <Operator />, who
        operates Skrivbok (“Skrivbok”, “we”, “us”). They apply to the Skrivbok website and web
        application and every feature in it (the “Service”). By signing in to or using the Service
        you agree to these Terms. If you do not agree, do not use the Service.
      </P>

      <H2>1. Who can use Skrivbok</H2>
      <P>
        You must be at least 18 years old, or the age of majority where you live, to create an
        account. If you use Skrivbok on behalf of an institution or organisation, you confirm that
        you are allowed to accept these Terms for it.
      </P>

      <H2>2. The Service</H2>
      <P>
        Skrivbok is an online workspace for academic and research work. It lets you keep projects
        and invite teammates to them, record ideas, notes and voice notes, write a journal, track
        deadlines with reminders, keep a literature library, plan future work and career goals,
        manage a calendar and meetings with teammates, and build a profile and résumé. Skrivbok does
        not generate content with artificial intelligence.
      </P>

      <H2>3. Your account</H2>
      <List
        items={[
          'You sign in with your Google account. You are responsible for keeping that account secure; anyone who can sign in to it can use your Skrivbok account.',
          'Keep the information in your account accurate, and use one account per person.',
          'You are responsible for what happens under your account. Tell us promptly if you believe it has been used without your permission.',
        ]}
      />

      <H2>4. Plans, prices and payment</H2>
      <P>
        Skrivbok has a <B>Free</B> plan and a paid <B>PRO</B> plan. The Free plan allows up to{' '}
        {FREE_LIMIT} projects, {FREE_LIMIT} career goals and {FREE_LIMIT} literature entries; PRO
        removes those limits. Ideas, notes, journal entries, deadlines and calendar events are
        unlimited on both.
      </P>
      <P>
        PRO is sold as a prepaid period: <B>{PRICES.monthly} for one month</B> or{' '}
        <B>{PRICES.yearly} for one year</B>, in Indian Rupees. The price you pay is the one shown at
        checkout.
      </P>
      <List
        items={[
          'Payments are processed by Razorpay. We never receive or store your card, UPI or bank account details.',
          'PRO starts as soon as your payment is confirmed and runs until the end date shown on your plan page.',
          <>
            <B>PRO does not renew automatically and you are never charged again without acting.</B>{' '}
            We remind you before your period ends. Paying again extends PRO from your current end
            date.
          </>,
          'When a PRO period ends, your account returns to the Free plan. Everything you created is kept and remains readable; you cannot add new items beyond the Free limits until you are within them or buy PRO again.',
        ]}
      />
      <P>
        Refunds are covered by our <To to="/refund-policy">Refund and Cancellation Policy</To>, and
        how PRO is delivered by our <To to="/shipping-policy">Shipping and Delivery Policy</To>.
      </P>

      <H2>5. Your content</H2>
      <P>
        Everything you put into Skrivbok — projects, notes, recordings, entries, files and profile
        details (“Your Content”) — remains yours. You give us permission to store, process and
        display Your Content only as needed to run the Service for you, including showing it to the
        people you choose to share it with.
      </P>
      <List
        items={[
          'Members you add to a project can see that project and its meetings, according to the role you give them.',
          'A teammate you allow to see your calendar sees when you are busy; they see the details only of events that include them, or of events you mark Public if you allow that.',
          'A review you submit is published on our website with your name and photo only after we approve it.',
        ]}
      />
      <P>
        You are responsible for Your Content and for having the right to upload it. Do not add
        anything unlawful, infringing, defamatory, or that invades someone’s privacy.
      </P>

      <H2>6. Acceptable use</H2>
      <P>You agree not to:</P>
      <List
        items={[
          'break the law or infringe anyone’s rights using the Service;',
          'try to access accounts, data or systems that are not yours, or to bypass limits or security measures;',
          'interfere with or overload the Service, or use bots or scrapers against it;',
          'copy, resell or reverse engineer the Service, or use it to build a competing product;',
          'invite people or send meeting requests to harass or spam them.',
        ]}
      />

      <H2>7. Our intellectual property</H2>
      <P>
        The Service, including its software, design, text, graphics and the Skrivbok name and logo,
        belongs to us or our licensors. These Terms do not give you any right to use them except to
        use the Service as intended.
      </P>

      <H2>8. Third-party services</H2>
      <P>
        Skrivbok relies on third parties to work: Google for sign-in, Razorpay for payments, and
        providers for email delivery, file storage and hosting. Their own terms apply to your use of
        their services. We are not responsible for services we do not operate.
      </P>

      <H2>9. Changes to the Service</H2>
      <P>
        We may add, change or remove features. If a change materially reduces what a paid PRO period
        includes, we will tell you in advance and, if you ask, refund the unused part of that
        period.
      </P>

      <H2>10. Suspension and termination</H2>
      <P>
        You can stop using Skrivbok at any time, and ask us to delete your account by writing to us
        (see our <To to="/privacy-policy">Privacy Policy</To>). We may suspend or close an account
        that breaches these Terms or puts the Service or other users at risk. Where we close an
        account without a breach on your part, we refund the unused part of any PRO period.
      </P>

      <H2>11. Disclaimer</H2>
      <P>
        We work to keep Skrivbok available and your data safe, but the Service is provided “as is”
        and “as available”. To the extent the law allows, we do not promise that it will be
        uninterrupted or error-free, and you should keep your own copies of anything important.
      </P>

      <H2>12. Limitation of liability</H2>
      <P>
        To the extent the law allows, we are not liable for indirect, incidental or consequential
        losses, or for loss of data, profits or opportunities. Our total liability to you for any
        claim is limited to the amount you paid us in the 12 months before the claim arose. Nothing
        in these Terms limits liability that cannot be limited by law.
      </P>

      <H2>13. Indemnity</H2>
      <P>
        You agree to compensate us for claims and costs arising from Your Content or from your
        breach of these Terms.
      </P>

      <H2>14. Governing law and disputes</H2>
      <P>
        These Terms are governed by the laws of India. Disputes will first be raised with us so we
        can try to resolve them; failing that, they are subject to the exclusive jurisdiction of the
        courts at <Fill value={BUSINESS.jurisdiction} what="city and state" />.
      </P>

      <H2>15. Changes to these Terms</H2>
      <P>
        We may update these Terms. The date at the top shows when they last changed. For material
        changes we will let signed-in users know by email or in the app before they take effect.
        Continuing to use the Service after that means you accept the updated Terms.
      </P>

      <H2>16. Contact</H2>
      <P>Questions about these Terms:</P>
      <ContactBlock />
    </>
  );
}

/* ── Privacy Policy ───────────────────────────────────────────────────────── */

function Privacy() {
  return (
    <>
      <P>
        This Privacy Policy explains what personal data Skrivbok collects, why, who it is shared
        with, how long it is kept, and the choices you have. Skrivbok is operated by <Operator />{' '}
        (“we”, “us”), which decides how your personal data is used and is responsible for it,
        including as a Data Fiduciary under India’s Digital Personal Data Protection Act, 2023.
      </P>

      <H2>1. What we collect</H2>
      <H3>When you sign in</H3>
      <P>
        Skrivbok uses Google sign-in; there is no Skrivbok password. From Google we receive your{' '}
        <B>name</B>, <B>email address</B> and your Google account identifier.
      </P>
      <H3>What you add</H3>
      <List
        items={[
          'The content you create: projects, ideas, notes, voice recordings, journal entries, deadlines, literature, future work, career goals, calendar events and meetings.',
          'Profile and résumé details you choose to enter, such as your designation, institution, contact details, degrees, positions, courses, grants and awards, and a profile photo if you upload one.',
          'Names and email addresses of the people you invite to projects or meetings, or ask to share calendars with.',
          'Bug reports and reviews you send us.',
        ]}
      />
      <H3>When you pay</H3>
      <P>
        The plan bought, amount, currency, payment status and the Razorpay order and payment
        references. Card, UPI and bank details are entered with Razorpay and never reach us.
      </P>
      <H3>Automatically</H3>
      <List
        items={[
          'The IP address and browser type recorded with each signed-in session, used to keep your account secure.',
          'Your timezone, so reminders arrive at the right time.',
          'Server logs of requests, kept for security and to fix faults.',
        ]}
      />

      <H2>2. Cookies and local storage</H2>
      <P>We use only what the Service needs to work:</P>
      <List
        items={[
          <>
            <B>skrivbok_sid</B> — keeps you signed in. It lasts 30 days and is renewed while you use
            Skrivbok.
          </>,
          <>
            <B>skrivbok_oauth_state</B> — protects the Google sign-in step. It lasts 10 minutes.
          </>,
          'Your browser’s local storage, for display preferences such as the calendar view you last chose.',
        ]}
      />
      <P>
        We do not use advertising or analytics cookies, and we do not track you across other
        websites.
      </P>

      <H2>3. How we use your data</H2>
      <List
        items={[
          'To provide the Service: store your work and show it to you and to the people you share it with.',
          'To send the emails and notifications you expect: invitations, meeting requests, reminders, receipts and account notices. Reminder emails can be turned off in Settings.',
          'To process payments and keep the records the law requires.',
          'To keep accounts and the Service secure, prevent abuse, and fix problems.',
          'To answer your support requests and reports.',
        ]}
      />
      <P>We do not sell your personal data, and we do not use it for advertising.</P>

      <H2>4. Who we share it with</H2>
      <H3>People you choose</H3>
      <P>
        Teammates you add to a project see that project. A teammate you allow to see your calendar
        sees your busy times, and the details only of events that include them (or of events you
        mark Public, if you allow it). Approved reviews are shown publicly with your name and photo.
      </P>
      <H3>Service providers</H3>
      <P>
        These providers process data on our behalf, only to run the Service, under their own
        security and privacy commitments:
      </P>
      <List
        items={[
          <>
            <B>Google</B> — sign-in.
          </>,
          <>
            <B>Razorpay</B> — payment processing.
          </>,
          <>
            <B>Brevo</B> — sending email.
          </>,
          <>
            <B>Cloudinary</B> — storing profile photos and voice notes.
          </>,
          <>
            <B>Vercel</B> and <B>Neon</B> — hosting the application and its database.
          </>,
        ]}
      />
      <P>
        Some of these providers store and process data on servers outside India. We may also
        disclose data where the law requires it, or to protect the rights and safety of our users
        and the Service.
      </P>

      <H2>5. How long we keep it</H2>
      <List
        items={[
          'Your account and content: for as long as your account exists.',
          'Sign-in sessions: until they expire after 30 days without use, after which they are removed.',
          'Records of reminders sent: 90 days.',
          'Payment records: for as long as tax and accounting law requires, even after an account is deleted.',
        ]}
      />
      <P>
        When you ask us to delete your account, we delete it and your content within 30 days, except
        records we must keep by law.
      </P>

      <H2>6. Your rights</H2>
      <P>Subject to applicable law, you can:</P>
      <List
        items={[
          'see and correct most of your data directly in Skrivbok, and ask us for a copy of it;',
          'ask us to correct, complete or delete your personal data, or to delete your account;',
          'withdraw consent, which may mean we can no longer provide the Service to you;',
          'nominate another person to exercise your rights if you die or become incapacitated;',
          'raise a grievance with our Grievance Officer, and, if it is not resolved, complain to the Data Protection Board of India.',
        ]}
      />
      <P>
        To exercise any of these, email <SupportEmail /> from the address on your account. We reply
        within 7 days and act on the request within 30 days.
      </P>

      <H2>7. Security</H2>
      <P>
        All traffic to Skrivbok is encrypted with HTTPS, sign-in session tokens are stored only in
        hashed form, and every request is checked against what your account is allowed to see. No
        system is perfectly secure; if a breach affects your personal data, we will tell you and the
        authorities as the law requires.
      </P>

      <H2>8. Children</H2>
      <P>
        Skrivbok is not meant for anyone under 18, and we do not knowingly collect personal data
        from children. If you believe a child has given us personal data, contact us and we will
        delete it.
      </P>

      <H2>9. Changes to this policy</H2>
      <P>
        We may update this policy. The date at the top shows when it last changed, and for material
        changes we will let signed-in users know by email or in the app.
      </P>

      <H2>10. Contact and Grievance Officer</H2>
      <P>
        <B>Grievance Officer:</B> <Fill value={BUSINESS.grievanceOfficer} what="name" />
      </P>
      <ContactBlock />
    </>
  );
}

/* ── Refund and Cancellation Policy ───────────────────────────────────────── */

function Refund() {
  return (
    <>
      <P>
        This policy explains how cancelling and refunds work for Skrivbok PRO. It is part of our{' '}
        <To to="/terms">Terms and Conditions</To>.
      </P>

      <H2>1. How PRO is billed</H2>
      <P>
        PRO is a one-time, prepaid purchase of a fixed period: {PRICES.monthly} for one month or{' '}
        {PRICES.yearly} for one year. <B>It does not renew automatically</B>, so you are never
        charged again unless you choose to pay again.
      </P>

      <H2>2. Cancellation</H2>
      <P>
        Because PRO does not renew, there is no subscription to cancel and nothing further will be
        charged. If you no longer want PRO, simply do not buy another period. Your PRO access
        continues until its end date, after which your account returns to the Free plan with all
        your content kept.
      </P>

      <H2>3. When you can get a refund</H2>
      <H3>Within 7 days of paying</H3>
      <P>
        If you are not satisfied, ask for a refund within <B>7 days of your payment</B> and we will
        refund it in full. This applies once per account.
      </P>
      <H3>At any time</H3>
      <P>We always refund:</P>
      <List
        items={[
          'a duplicate charge for the same purchase;',
          'a payment taken from your account for which PRO was not activated, if we cannot activate it within 2 business days of you telling us;',
          'a charge for a different amount from the price shown at checkout.',
        ]}
      />
      <P>
        We also refund the unused part of a PRO period if we close your account without a breach on
        your part, or materially reduce what PRO includes during your period.
      </P>
      <H3>When refunds are not given</H3>
      <P>
        Outside the cases above, payments are not refunded, including for the unused part of a
        period you have stopped using, or where an account was closed for breaching our Terms.
      </P>

      <H2>4. How to ask for a refund</H2>
      <P>
        Email <SupportEmail /> from the address on your Skrivbok account, with:
      </P>
      <List
        items={[
          'the date and amount of the payment;',
          'the Razorpay payment reference, shown in Payment history on your plan page;',
          'the reason for the request.',
        ]}
      />

      <H2>5. How refunds are paid</H2>
      <P>
        We reply within 2 business days. An approved refund is issued through Razorpay to the{' '}
        <B>original payment method</B> within 5–7 business days of approval. Your bank or card
        issuer may take a further 5–10 business days to show it.
      </P>
      <P>
        When a payment is refunded, the PRO period it bought ends and your account returns to the
        Free plan; your content is kept.
      </P>

      <H2>6. Failed payments</H2>
      <P>
        If money leaves your account but the payment fails, it is normally returned automatically by
        Razorpay or your bank within 5–7 business days. If it has not been, contact us with the
        details above.
      </P>

      <H2>7. Contact</H2>
      <ContactBlock />
    </>
  );
}

/* ── Shipping and Delivery Policy ─────────────────────────────────────────── */

function Shipping() {
  return (
    <>
      <P>
        Skrivbok is an online service. Nothing physical is sold or shipped, and there are no
        shipping charges.
      </P>

      <H2>1. What is delivered</H2>
      <P>
        Buying PRO upgrades your Skrivbok account for the period you paid for ({PRICES.monthly} for
        one month or {PRICES.yearly} for one year). It is delivered to the account you are signed in
        to when you pay.
      </P>

      <H2>2. When it is delivered</H2>
      <P>
        PRO is activated <B>as soon as Razorpay confirms your payment</B> — normally within a few
        minutes. You will see it on your plan page, and receive an in-app notification and an email
        receipt with the period’s end date.
      </P>

      <H2>3. If it has not arrived</H2>
      <P>
        If your account does not show PRO within 24 hours of a successful payment, email{' '}
        <SupportEmail /> with the Razorpay payment reference. If we cannot activate it within 2
        business days, we refund the payment in full, as set out in our{' '}
        <To to="/refund-policy">Refund and Cancellation Policy</To>.
      </P>

      <H2>4. Where the service is available</H2>
      <P>
        Skrivbok can be used anywhere with an internet connection, in a current web browser. Prices
        are charged in Indian Rupees.
      </P>

      <H2>5. Contact</H2>
      <ContactBlock />
    </>
  );
}

/* ── End User License Agreement ───────────────────────────────────────────── */

function Eula() {
  return (
    <>
      <P>
        This End User License Agreement (“EULA”) sets out the licence under which you use the
        Skrivbok software. It sits alongside our <To to="/terms">Terms and Conditions</To>, which
        govern your use of the Service as a whole; if the two ever conflict, the Terms prevail.
      </P>

      <H2>1. Licence</H2>
      <P>
        <Operator /> grants you a personal, limited, non-exclusive, non-transferable, revocable
        licence to access and use Skrivbok through a web browser, for your own academic, research
        and professional work, within the features of your plan (Free or PRO).
      </P>

      <H2>2. Restrictions</H2>
      <P>You may not:</P>
      <List
        items={[
          'copy, modify, distribute, sell, rent or sublicense the software;',
          'reverse engineer, decompile or try to extract its source code, except where the law allows it;',
          'remove or alter any copyright, trademark or other notices;',
          'use automated means to access the software, or use it to build a competing product.',
        ]}
      />

      <H2>3. Ownership</H2>
      <P>
        The software is licensed, not sold. We and our licensors keep all rights in it. You keep all
        rights in the content you create with it, as described in the Terms.
      </P>

      <H2>4. Updates</H2>
      <P>
        Skrivbok is a web application, so updates are applied for everyone automatically. This EULA
        applies to each version.
      </P>

      <H2>5. Termination</H2>
      <P>
        This licence lasts until your account is closed. It ends automatically if you breach this
        EULA or the Terms. When it ends you must stop using the software; you can ask for a copy of
        your data before your account is deleted.
      </P>

      <H2>6. Disclaimer and liability</H2>
      <P>
        The disclaimer and limitation of liability in the <To to="/terms">Terms and Conditions</To>{' '}
        apply to the software.
      </P>

      <H2>7. Governing law</H2>
      <P>
        This EULA is governed by the laws of India, and disputes are subject to the exclusive
        jurisdiction of the courts at <Fill value={BUSINESS.jurisdiction} what="city and state" />.
      </P>

      <H2>8. Contact</H2>
      <ContactBlock />
    </>
  );
}

/* ── Contact Us ───────────────────────────────────────────────────────────── */

const TOPICS = [
  { value: 'General Inquiry', label: 'General Inquiry' },
  { value: 'Technical Support', label: 'Technical Support' },
  { value: 'Billing & Refunds', label: 'Billing & Refunds' },
  { value: 'Privacy & Data Requests', label: 'Privacy & Data Requests' },
  { value: 'Feedback & Suggestions', label: 'Feedback & Suggestions' },
];

function ContactItem({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid size-11 flex-none place-items-center rounded-[10px] bg-brand-tint text-brand-ink">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-3">{children}</p>
      </div>
    </div>
  );
}

/**
 * The message form.
 *
 * There is no public inbox on the server, so this does not pretend to send:
 * it opens the visitor's own email app with the message addressed and filled
 * in, and says so under the button. A form that showed "sent" and went
 * nowhere would lose people's messages without their knowing.
 */
function ContactForm() {
  const [opened, setOpened] = useState(false);
  const email = BUSINESS.email;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const from = String(form.get('email') ?? '').trim();
    const topic = String(form.get('topic') ?? '').trim();
    const message = String(form.get('message') ?? '').trim();

    const subject = `${topic} — ${name}`;
    const body = `${message}\n\n${name} <${from}>`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setOpened(true);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface-5 p-6"
    >
      {opened ? (
        <p
          role="status"
          className="rounded-[10px] bg-mint-tint px-4 py-3 text-[13.5px] font-semibold text-[#2e7d55]"
        >
          Your email app should have opened with the message ready — send it from there. If nothing
          opened, write to <SupportEmail /> directly.
        </p>
      ) : null}
      <Field label="Full Name" name="name" placeholder="Your name" required />
      <Field
        label="Email Address"
        name="email"
        type="email"
        placeholder="you@example.com"
        required
      />
      <Select
        label="Subject"
        name="topic"
        defaultValue={TOPICS[0]?.value}
        options={TOPICS}
        required
      />
      <Textarea
        label="Message"
        name="message"
        rows={5}
        placeholder="Tell us how we can help..."
        required
      />
      <Button type="submit" variant="brand" icon="send" className="w-full" disabled={!email}>
        Send Message
      </Button>
      <p className="-mt-1 text-center text-[12px] text-ink-4">
        Opens your email app with the message addressed to us.
      </p>
    </form>
  );
}

function Contact() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div>
        <h2 className="text-[24px] leading-snug font-bold tracking-[-0.01em] text-ink">
          Get in Touch
        </h2>
        <p className="mt-3 text-[15px] leading-[1.8] text-ink-3">
          Questions about Skrivbok, help with your account, billing and refunds, or a request about
          your personal data — write to us and we reply within 2 business days.
        </p>
        <div className="mt-8 flex flex-col gap-6">
          <ContactItem icon="mail" title="Email">
            <SupportEmail />
          </ContactItem>
          <ContactItem icon="call" title="Phone">
            <Fill value={BUSINESS.phone} what="phone number" />
          </ContactItem>
          <ContactItem icon="location_on" title="Address">
            <Operator />
            <br />
            <Fill value={BUSINESS.address} what="operating address" />
          </ContactItem>
          <ContactItem icon="schedule" title="Response time">
            Within 2 business days
          </ContactItem>
          <ContactItem icon="shield_person" title="Grievance Officer">
            <Fill value={BUSINESS.grievanceOfficer} what="name" /> — reachable at the email above
          </ContactItem>
        </div>
      </div>
      <ContactForm />
    </div>
  );
}

/* ── The table ────────────────────────────────────────────────────────────── */

export interface LegalDoc {
  title: string;
  /** Under the title: when it was last changed, or for the contact page, its welcome. */
  subtitle: string;
  /** The contact page is two columns, so it is given more room. */
  wide?: boolean;
  body: ReactNode;
}

export const LEGAL_DOCS = {
  terms: { title: 'Terms and Conditions', subtitle: UPDATED, body: <Terms /> },
  privacy: { title: 'Privacy Policy', subtitle: UPDATED, body: <Privacy /> },
  refund: { title: 'Refund and Cancellation Policy', subtitle: UPDATED, body: <Refund /> },
  shipping: { title: 'Shipping and Delivery Policy', subtitle: UPDATED, body: <Shipping /> },
  eula: { title: 'End User License Agreement', subtitle: UPDATED, body: <Eula /> },
  contact: {
    title: 'Contact Us',
    subtitle:
      'We’d love to hear from you. Reach out with questions, feedback, or just to say hello.',
    wide: true,
    body: <Contact />,
  },
} satisfies Record<string, LegalDoc>;
