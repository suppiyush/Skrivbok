/**
 * The five legal pages, from one template.
 *
 * They share a layout and differ only in content, so they share a component.
 * The Refund Policy and Terms are a payment-provider requirement and must stay
 * reachable from every public footer.
 */
import { MarketingFooter, MarketingNav, Section } from '../components/marketing/MarketingChrome';

const DOCS = {
  terms: { title: 'Terms of Service', updated: 'September 2026' },
  privacy: { title: 'Privacy Policy', updated: 'September 2026' },
  eula: { title: 'End User Agreement', updated: 'September 2026' },
  refund: { title: 'Refund Policy', updated: 'September 2026' },
  contact: { title: 'Contact', updated: '' },
} as const;

export default function Legal({ doc }: { doc: keyof typeof DOCS }) {
  const meta = DOCS[doc];

  return (
    <div className="min-h-screen bg-canvas-alt">
      <MarketingNav />
      <main>
        <Section className="py-16">
          <div className="mx-auto max-w-[72ch]">
            <h1 className="text-[clamp(30px,4vw,42px)] font-extrabold tracking-[-0.035em]">
              {meta.title}
            </h1>
            {meta.updated ? (
              <p className="mt-3 text-[13.5px] text-ink-3">Last updated {meta.updated}</p>
            ) : null}

            <div className="mt-10 rounded-[24px] bg-surface p-8 sm:p-12">
              <p className="text-[15px] leading-[1.8] text-ink-3">
                This page is a placeholder. The final wording is being prepared with the client and
                will replace this text before launch — it is deliberately not drafted here, because
                legal copy should not be invented by the people building the software.
              </p>
              <p className="mt-5 text-[15px] leading-[1.8] text-ink-3">
                The layout, reading width and heading hierarchy are final: long-form documents are
                set at roughly 72 characters per line with a clear heading structure, and a table of
                contents is added for any document that runs past four sections.
              </p>
              <p className="mt-5 text-[15px] leading-[1.8] text-ink-3">
                Questions in the meantime:{' '}
                <a href="mailto:hello@skrivbok.app" className="font-semibold text-brand-ink">hello@skrivbok.app</a>.
              </p>
            </div>
          </div>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
