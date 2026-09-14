/**
 * The words of the five public documents.
 *
 * Supplied by the client (design/TermsAndConditions.tsx and its siblings) and
 * transcribed here as written; only the markup is ours. Straight quotes are
 * set as typographic ones, links go through the router, and addresses are
 * mail links. The page around them is `Legal.tsx`.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Select, Textarea } from '../../components/ui/Form';
import { Icon } from '../../components/ui/Icon';

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

function Closing({ children }: { children: ReactNode }) {
  return <p className="mt-8 text-[15px] leading-[1.8] text-ink-4 italic">{children}</p>;
}

function To({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-brand-ink underline underline-offset-2">
      {children}
    </Link>
  );
}

function Mail({ address }: { address: string }) {
  return (
    <a
      href={`mailto:${address}`}
      className="font-semibold text-brand-ink underline underline-offset-2"
    >
      {address}
    </a>
  );
}

/* ── Terms and Conditions ─────────────────────────────────────────────────── */

function Terms() {
  return (
    <>
      <P>
        Welcome to Skrivbok. By accessing or using this website, you agree to comply with and be
        bound by the following Terms &amp; Conditions. If you do not agree with any part of these
        terms, please do not use this website.
      </P>
      <P>
        Skrivbok reserves the right to modify, update, or change these Terms &amp; Conditions at any
        time without prior notice. Continued use of the website following any changes constitutes
        acceptance of those changes.
      </P>
      <P>Any rights not expressly granted herein are reserved.</P>

      <H2>Use of Website</H2>
      <P>
        You may access and use this website solely for lawful purposes and in accordance with these
        Terms &amp; Conditions. You agree not to misuse the website, interfere with its operation,
        or attempt unauthorized access to any part of the platform, servers, or connected networks.
      </P>
      <P>
        There are inherent risks associated with the use of internet-based services and downloadable
        content. Skrivbok advises users to ensure proper security measures, including virus
        protection and data backups. You are solely responsible for protecting your devices,
        systems, and data while using this website.
      </P>

      <H2>Intellectual Property</H2>
      <P>
        All content available on this website, including but not limited to text, graphics, logos,
        icons, images, videos, software, designs, layouts, and trademarks (collectively, “Content”),
        is owned by or licensed to Skrivbok and is protected under applicable copyright, trademark,
        and intellectual property laws.
      </P>
      <P>
        Except as expressly permitted, you may not copy, reproduce, distribute, modify, publish,
        transmit, display, sell, or exploit any Content without prior written permission from
        Skrivbok.
      </P>

      <H2>Images, Logos &amp; Trademarks</H2>
      <P>
        All logos, page headers, graphics, icons, and service names displayed on this website are
        trademarks, service marks, or trade dress of Skrivbok or its licensors.
      </P>
      <P>
        Unauthorized use, copying, imitation, or distribution of any trademarks or branding
        materials is strictly prohibited and may violate applicable laws.
      </P>

      <H2>User Content</H2>
      <P>
        Users may submit or upload content to the website where applicable. You agree not to upload
        unlawful, defamatory, harmful, infringing, or misleading material. By submitting any
        content, you grant Skrivbok a non-exclusive, worldwide, royalty-free license to modify such
        content for operating and improving the platform.
      </P>

      <H2>Indemnity</H2>
      <P>
        You agree to defend, indemnify, and hold harmless Skrivbok, its affiliates, partners,
        employees, directors, and agents from and against any claims, liabilities, damages, losses,
        expenses, or costs, including legal fees, arising from:
      </P>
      <List
        items={[
          'Your use of the website,',
          'Your violation of these Terms,',
          'Your infringement of any third-party rights,',
          'Any content submitted by you.',
        ]}
      />

      <H2>Feedback</H2>
      <P>
        Any suggestions, comments, ideas, feedback, or recommendations submitted to Skrivbok
        regarding the website or services shall be considered non-confidential and non-proprietary.
      </P>
      <P>
        Skrivbok shall be free to use, reproduce, modify, publish, or distribute such feedback
        without restriction or compensation to the user.
      </P>

      <H2>Third-Party Links</H2>
      <P>
        This website may contain links to third-party websites or services for user convenience.
        Skrivbok does not control or endorse such third-party websites and is not responsible for
        their content, policies, or practices.
      </P>
      <P>Users access third-party websites at their own risk.</P>

      <H2>Disclaimer of Warranties</H2>
      <P>
        All services and information provided on this website are offered on an “as is” and “as
        available” basis without warranties of any kind, whether express or implied.
      </P>
      <P>
        Skrivbok does not guarantee uninterrupted access, accuracy, reliability, or error-free
        operation of the website or services.
      </P>

      <H2>Limitation of Liability</H2>
      <P>
        To the maximum extent permitted by law, Skrivbok shall not be liable for any indirect,
        incidental, consequential, special, or punitive damages arising from the use of or inability
        to use the website or services.
      </P>

      <H2>Copyright Policy</H2>
      <P>
        All materials on this website are protected by applicable copyright laws. Unauthorized
        copying, reproduction, or redistribution of any material from this website is prohibited
        without prior written consent from Skrivbok.
      </P>
      <P>You may not remove, alter, or obscure any copyright, trademark, or proprietary notices.</P>

      <H2>Privacy</H2>
      <P>
        Your use of the website is also governed by our Privacy Policy available on{' '}
        <To to="/privacy-policy">Skrivbok Privacy Policy</To>.
      </P>

      <H2>Termination</H2>
      <P>
        Skrivbok reserves the right to suspend or terminate user access to the website at any time
        without prior notice if any violation of these Terms &amp; Conditions is detected.
      </P>

      <H2>Governing Law</H2>
      <P>
        These Terms &amp; Conditions shall be governed and interpreted in accordance with the
        applicable laws of India, without regard to conflict of law principles.
      </P>
      <P>
        Any disputes arising in connection with these Terms shall be subject to the exclusive
        jurisdiction of the competent courts in Jammu and Kashmir, India.
      </P>

      <H2>Contact Information</H2>
      <P>
        For questions, support, or legal concerns regarding these Terms &amp; Conditions, please
        contact:
      </P>
      <P>
        <B>Website:</B> <To to="/">Skrivbok.com</To>
        <br />
        <B>Email:</B> <Mail address="support.skrivbok@gmail.com" />
      </P>
      <Closing>
        By using this website, you acknowledge that you have read, understood, and agreed to these
        Terms &amp; Conditions.
      </Closing>
    </>
  );
}

/* ── Privacy Policy ───────────────────────────────────────────────────────── */

function Privacy() {
  return (
    <>
      <P>
        <B>IMPORTANT: THIS IS A LICENSE, NOT A SALE</B>
      </P>
      <P>
        This Skrivbok License Agreement is between the end user (hereinafter referred to as You or
        Licensee), and Skrivbok.
      </P>
      <P>
        <B>IMPORTANT:</B> Skrivbok’s PRIVACY POLICY EXPLAINS HOW WE COLLECT, TREAT YOUR PERSONAL
        DATA AND PROTECT YOUR PRIVACY WHEN YOU USE OUR SERVICES. BY USING OUR SERVICES, YOU AGREE TO
        BE BOUND BY THE PRIVACY POLICY OR PRIVACY NOTICE PUBLISHED BY SKRIVBOK ON ITS WEBSITE. BY
        DOWNLOADING, ACCESSING, INSTALLING OR USING THE SERVICE, YOU ALSO AGREE TO BE BOUND BY THE
        FOLLOWING TERMS AND CONDITIONS OF THIS AGREEMENT.
      </P>
      <P>
        Please read this agreement carefully before using this website. Top attention should be paid
        to such clauses including but not limited to Article 3, 5, 14, 15, 16, 19. If you disagree
        with or have any questions concerning this END USER LICENSE AGREEMENT (EULA), please contact
        Skrivbok. Any installing, copying, accessing, or using the Licensed Software by you (the
        “Licensee”) constitutes an acceptance of, and a promise to comply with, all the terms and
        conditions of this EULA
      </P>

      <H2>Terms and Conditions:</H2>

      <H2>1. Services</H2>
      <P>
        Skrivbok provides digital tools, AI-powered writing assistance, content creation services,
        and related online features (“Services”). All services are provided subject to these Terms.
      </P>

      <H2>2. License &amp; Permitted Use</H2>
      <P>
        Subject to compliance with these Terms, Skrivbok grants you a limited, non-exclusive,
        non-transferable, revocable license to access and use the platform for personal or
        authorized business purposes.
      </P>
      <P>You may not:</P>
      <List
        items={[
          'Copy, distribute, resell, sublicense, or commercially exploit the platform without written permission.',
          'Reverse engineer, decompile, modify, or attempt to extract source code.',
          'Use the platform for illegal, harmful, fraudulent, or unauthorized purposes.',
          'Share account credentials or provide unauthorized access to others.',
          'Use automated systems, bots, or scraping tools without authorization.',
        ]}
      />
      <P>All rights not expressly granted remain reserved by Skrivbok.</P>

      <H2>3. User Accounts</H2>
      <P>You may be required to create an account to access certain services.</P>
      <P>You are responsible for:</P>
      <List
        items={[
          'Maintaining account confidentiality,',
          'All activities under your account,',
          'Providing accurate and current information.',
        ]}
      />
      <P>Skrivbok reserves the right to suspend or terminate accounts that violate these Terms.</P>

      <H2>4. User Content</H2>
      <P>
        You retain ownership of the content you create or upload using Skrivbok (“User Content”).
      </P>
      <P>
        By using the platform, you grant Skrivbok a limited license to process, store, display, and
        use your content solely for operating, improving, and providing the Services.
      </P>
      <P>You agree not to upload or generate content that:</P>
      <List
        items={[
          'Violates laws or regulations,',
          'Infringes intellectual property rights,',
          'Contains harmful, abusive, defamatory, or illegal material,',
          'Violates privacy or third-party rights.',
        ]}
      />
      <P>You are solely responsible for your User Content.</P>

      <H2>5. AI-Generated Content</H2>
      <P>
        Skrivbok may provide AI-generated outputs and suggestions. Due to the nature of artificial
        intelligence, outputs may not always be accurate, unique, or suitable for every purpose.
      </P>
      <P>
        Users are solely responsible for reviewing, verifying, and using generated content
        appropriately.
      </P>
      <P>
        Skrivbok does not guarantee the accuracy, legality, or reliability of AI-generated content.
      </P>

      <H2>6. Subscriptions &amp; Payments</H2>
      <P>Certain features may require paid subscriptions or one-time purchases.</P>
      <P>By purchasing a service, you agree to:</P>
      <List
        items={[
          'Pay all applicable charges,',
          'Authorize recurring billing where applicable,',
          'Provide valid payment information.',
        ]}
      />
      <P>Subscription plans automatically renew unless canceled before the renewal date.</P>

      <H2>7. Refund Policy</H2>
      <P>Refunds are governed by our Refund Policy available at:</P>
      <P>
        <To to="/refund-policy">Skrivbok Refund Policy</To>
      </P>

      <H2>8. Intellectual Property</H2>
      <P>
        All platform content, branding, software, designs, logos, graphics, and technology are owned
        by or licensed to Skrivbok and protected by intellectual property laws.
      </P>
      <P>
        You may not use Skrivbok trademarks, branding, or copyrighted material without prior written
        permission.
      </P>

      <H2>9. Third-Party Services</H2>
      <P>Skrivbok may integrate or link to third-party services, tools, or websites.</P>
      <P>We are not responsible for:</P>
      <List
        items={[
          'Third-party content,',
          'Availability of third-party services,',
          'External privacy practices or policies.',
        ]}
      />
      <P>Use of third-party services is at your own risk.</P>

      <H2>10. Privacy</H2>
      <P>Your use of the platform is also governed by our Privacy Policy:</P>
      <P>
        <To to="/privacy-policy">Skrivbok Privacy Policy</To>
      </P>

      <H2>11. Disclaimer of Warranties</H2>
      <P>The platform and services are provided on an “as is” and “as available” basis.</P>
      <P>Skrivbok makes no warranties regarding:</P>
      <List
        items={[
          'Accuracy or reliability,',
          'Continuous availability,',
          'Error-free operation,',
          'Fitness for a particular purpose.',
        ]}
      />
      <P>Use of the platform is at your own risk.</P>

      <H2>12. Limitation of Liability</H2>
      <P>
        To the maximum extent permitted by law, Skrivbok shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages arising from:
      </P>
      <List
        items={[
          'Use or inability to use the platform,',
          'AI-generated outputs,',
          'Loss of data, profits, or business opportunities,',
          'Unauthorized access or security breaches.',
        ]}
      />
      <P>
        Our total liability shall not exceed the amount paid by you for the applicable service in
        the preceding 12 months.
      </P>

      <H2>13. Termination</H2>
      <P>
        Skrivbok reserves the right to suspend or terminate access to the Services at any time if
        you violate these Terms or misuse the platform.
      </P>
      <P>Upon termination, your right to access and use the Services will immediately cease.</P>

      <H2>14. Governing Law</H2>
      <P>These Terms shall be governed by and interpreted in accordance with the laws of India.</P>
      <P>
        Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the
        courts located in Rajasthan, India.
      </P>

      <H2>15. Changes to Terms</H2>
      <P>
        Skrivbok may update or modify these Terms at any time. Continued use of the platform after
        changes become effective constitutes acceptance of the revised Terms.
      </P>

      <H2>16. Contact Us</H2>
      <P>For support or legal inquiries:</P>
      <P>
        <B>Website:</B> <To to="/">Skrivbok</To>
        <br />
        <B>Email:</B> <Mail address="support@skrivbok.com" />
      </P>
      <Closing>
        By using Skrivbok, you acknowledge that you have read, understood, and agreed to these Terms
        and Conditions.
      </Closing>
    </>
  );
}

/* ── Refund Policy ────────────────────────────────────────────────────────── */

function Refund() {
  return (
    <>
      <P>
        Thank you for using Skrivbok. We strive to provide services to all our users. Before
        requesting a refund, please review the following refund policy carefully to determine
        whether your purchase is eligible.
      </P>

      <H2>Non-Refundable Cases</H2>
      <P>The following situations are generally not eligible for refunds:</P>
      <List
        items={[
          'The subscription, license, credits, usage hours, tokens, or purchased digital resources have already been fully or partially used.',
          'The refund request is submitted after 30 days from the original purchase date.',
          'Dissatisfaction based solely on personal preference, change of mind, or unmet expectations regarding features or outcomes.',
          'Unauthorized payments caused by credit card misuse, fraud, or third-party access. In such cases, users are advised to contact their payment provider or bank immediately.',
          'Price differences due to regional pricing, promotional offers, discounts, taxes, exchange rates, or special campaigns.',
          'Refund requests for partially used subscriptions.',
          'Duplicate purchases caused by user error where services have already been accessed or used.',
          'Technical issues caused by user devices, internet connectivity, unsupported systems, or failure to follow provided instructions.',
          'Refund requests where the user refuses to cooperate with our support team for troubleshooting or resolution attempts.',
          'Purchases made through third-party sellers, marketplaces, app stores, resellers, or external platforms. Refund requests for such purchases must be directed to the original seller or platform.',
          'Any violation of our Terms & Conditions or misuse of the platform.',
        ]}
      />

      <H2>General Refund Rules</H2>
      <P>
        Unless otherwise required by applicable law, all payments made to Skrivbok are generally
        non-refundable once digital services, subscriptions, or content access have been activated
        or used.
      </P>
      <P>
        Refund eligibility is determined solely at the discretion of Skrivbok after reviewing the
        request and purchase details.
      </P>

      <H2>Eligible Refund Cases</H2>
      <P>Refunds may be considered in the following situations:</P>
      <List
        items={[
          'You were charged multiple times for the same product or subscription.',
          'You accidentally purchased the wrong product or plan and have not used the purchased service.',
          'You were unable to access the purchased service due to a verified technical issue that could not be resolved within a reasonable timeframe.',
          'You did not receive access credentials, confirmation email, or activation after purchase and our support team could not resolve the issue.',
          'Billing errors or duplicate transactions occurred due to system malfunction.',
          'The purchased service was not delivered as described due to a verified platform-side issue.',
        ]}
      />

      <H2>Subscription Cancellation</H2>
      <P>
        Users may cancel recurring subscriptions at any time before the next billing cycle.
        Cancellation prevents future charges but does not automatically guarantee a refund for
        previous payments already processed.
      </P>

      <H2>Refund Process</H2>
      <P>To request a refund, please contact our support team with:</P>
      <List
        items={[
          'Your order number,',
          'Purchase email address,',
          'Payment details,',
          'Reason for the refund request.',
        ]}
      />
      <P>
        Refund requests will be reviewed within a reasonable period. Approved refunds will generally
        be processed using the original payment method.
      </P>

      <H2>License &amp; Access Termination</H2>
      <P>
        Once a refund is issued, access to the purchased subscription may be suspended or
        permanently terminated. Continued use after refund approval is prohibited.
      </P>

      <H2>Contact Us</H2>
      <P>For refund requests or billing support, please contact:</P>
      <P>
        <B>Website:</B> <To to="/">Skrivbok</To>
        <br />
        <B>Support Email:</B> <Mail address="support@skrivbok.com" />
      </P>
    </>
  );
}

/* ── End User License Agreement ───────────────────────────────────────────── */

function Eula() {
  return (
    <>
      <H2>1. Agreement to Terms</H2>
      <P>
        This End User License Agreement (“EULA”) is a legal agreement between you (“End User” or
        “you”) and Skrivbok (“Company”, “we”, or “us”) for the use of the Skrivbok platform and all
        related services, applications, and content (“Software”).
      </P>
      <P>
        By installing, accessing, or using the Software, you acknowledge that you have read,
        understood, and agree to be bound by the terms of this EULA. If you do not agree to these
        terms, do not use the Software.
      </P>

      <H2>2. License Grant</H2>
      <P>
        Subject to the terms of this EULA, Skrivbok grants you a limited, non-exclusive,
        non-transferable, revocable license to:
      </P>
      <List
        items={[
          'Access and use the Software for personal and professional productivity purposes',
          'Store and manage your data within the Platform',
          'Use the features available under your subscription tier (Free or PRO)',
        ]}
      />

      <H2>3. License Restrictions</H2>
      <P>You may not:</P>
      <List
        items={[
          'Copy, modify, or distribute the Software or any part thereof',
          'Reverse engineer, decompile, or disassemble the Software',
          'Rent, lease, lend, sell, or sublicense the Software',
          'Use the Software to build a competing product or service',
          'Remove or alter any proprietary notices, labels, or marks on the Software',
          'Use automated systems (bots, scrapers) to access the Platform',
        ]}
      />

      <H2>4. User Content</H2>
      <H3>4.1 Ownership</H3>
      <P>
        You retain full ownership of all content, data, documents, and materials you create, upload,
        or store using the Software (“User Content”).
      </P>
      <H3>4.2 License to Skrivbok</H3>
      <P>
        By using the Software, you grant Skrivbok a limited, non-exclusive license to host, store,
        and process your User Content solely for the purpose of providing and improving the service.
      </P>
      <H3>4.3 Responsibility</H3>
      <P>
        You are solely responsible for the legality, accuracy, and appropriateness of your User
        Content. Skrivbok does not endorse or assume liability for any User Content.
      </P>

      <H2>5. Subscription Tiers</H2>
      <P>
        Skrivbok offers both free and paid (PRO) tiers. Features and usage limits vary by tier. We
        reserve the right to modify tier features, pricing, and availability with reasonable notice.
      </P>

      <H2>6. Updates and Modifications</H2>
      <P>
        Skrivbok may update, modify, or enhance the Software from time to time. Such updates may be
        applied automatically. We will make reasonable efforts to ensure backward compatibility, but
        cannot guarantee that all features will remain unchanged.
      </P>

      <H2>7. Data Protection</H2>
      <P>
        We take data protection seriously. Your data is stored securely and processed in accordance
        with our Privacy Policy. We implement industry-standard security measures to protect your
        User Content from unauthorized access.
      </P>

      <H2>8. Disclaimer of Warranties</H2>
      <P>
        THE SOFTWARE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
        INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, AND NON-INFRINGEMENT. SKRIVBOK DOES NOT WARRANT THAT THE SOFTWARE WILL BE
        ERROR-FREE OR UNINTERRUPTED.
      </P>

      <H2>9. Limitation of Liability</H2>
      <P>
        IN NO EVENT SHALL SKRIVBOK BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
        OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, PROFITS, OR BUSINESS OPPORTUNITIES, ARISING
        FROM THE USE OR INABILITY TO USE THE SOFTWARE.
      </P>

      <H2>10. Termination</H2>
      <P>
        This EULA is effective until terminated. Your rights under this license will terminate
        automatically without notice if you fail to comply with any of its terms. Upon termination,
        you must cease all use of the Software. We will provide a reasonable period for you to
        export your data before account deletion.
      </P>

      <H2>11. Governing Law</H2>
      <P>
        This EULA shall be governed by the laws of India. Any disputes arising from this agreement
        shall be resolved in the courts of competent jurisdiction in India.
      </P>

      <H2>12. Contact Information</H2>
      <P>
        For questions regarding this EULA, please reach out through our{' '}
        <To to="/contact">Contact Us</To> page.
      </P>
    </>
  );
}

/* ── Contact Us ───────────────────────────────────────────────────────────── */

const SUPPORT_EMAIL = 'support@skrivbok.com';

const TOPICS = [
  { value: 'General Inquiry', label: 'General Inquiry' },
  { value: 'Technical Support', label: 'Technical Support' },
  { value: 'Billing & Refunds', label: 'Billing & Refunds' },
  { value: 'Feedback & Suggestions', label: 'Feedback & Suggestions' },
  { value: 'Partnership & Collaboration', label: 'Partnership & Collaboration' },
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
 * in, and says so on the button's line. A form that showed "sent" and went
 * nowhere would lose people's messages without their knowing.
 */
function ContactForm() {
  const [opened, setOpened] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const topic = String(form.get('topic') ?? '').trim();
    const message = String(form.get('message') ?? '').trim();

    const subject = `${topic} — ${name}`;
    const body = `${message}\n\n${name} <${email}>`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
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
          opened, write to <Mail address={SUPPORT_EMAIL} /> directly.
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
      <Button type="submit" variant="brand" icon="send" className="w-full">
        Send Message
      </Button>
      <p className="-mt-1 text-center text-[12px] text-ink-4">
        Opens your email app with the message addressed to {SUPPORT_EMAIL}.
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
          Have a question about Skrivbok? Need help with your account? We’re here to help and
          typically respond within 24 hours.
        </p>
        <div className="mt-8 flex flex-col gap-6">
          <ContactItem icon="mail" title="Email">
            <Mail address={SUPPORT_EMAIL} />
          </ContactItem>
          <ContactItem icon="schedule" title="Response Time">
            We aim to respond within 24 hours on business days
          </ContactItem>
          <ContactItem icon="shield" title="Privacy">
            Your information is kept confidential and used only to address your inquiry
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
  terms: {
    title: 'Terms and Conditions',
    subtitle: 'Last updated: May 12, 2026',
    body: <Terms />,
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'Last updated: May 12, 2026',
    body: <Privacy />,
  },
  eula: {
    title: 'End User License Agreement',
    subtitle: 'Last updated: May 12, 2026',
    body: <Eula />,
  },
  refund: {
    title: 'Refund Policy',
    subtitle: 'Last updated: May 12, 2026',
    body: <Refund />,
  },
  contact: {
    title: 'Contact Us',
    subtitle:
      'We’d love to hear from you. Reach out with questions, feedback, or just to say hello.',
    wide: true,
    body: <Contact />,
  },
} satisfies Record<string, LegalDoc>;
