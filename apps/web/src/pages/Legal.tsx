/**
 * The five public documents, from one template.
 *
 * They share a layout and differ only in content, so they share a component;
 * the words themselves are in `legal/content.tsx`, as supplied by the client.
 * The Refund Policy and Terms are a payment-provider requirement and must stay
 * reachable from every public footer.
 */
import { MarketingFooter, MarketingNav, Section } from '../components/marketing/MarketingChrome';
import { useAuth } from '../lib/auth';
import { LEGAL_DOCS, type LegalDoc } from './legal/content';

export default function Legal({ doc }: { doc: keyof typeof LEGAL_DOCS }) {
  const meta: LegalDoc = LEGAL_DOCS[doc];
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-canvas-alt">
      <MarketingNav isSignedIn={Boolean(user)} />
      <main>
        <Section className="py-16">
          {/* Documents are set at a reading width; the contact page has two
              columns side by side and is given the room for them. */}
          <div className={`mx-auto ${meta.wide ? 'max-w-[960px]' : 'max-w-[72ch]'}`}>
            <h1 className="text-[clamp(30px,4vw,42px)] font-extrabold tracking-[-0.035em]">
              {meta.title}
            </h1>
            <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-ink-3">
              {meta.subtitle}
            </p>

            <div className="mt-10 rounded-[24px] bg-surface p-6 sm:p-12">{meta.body}</div>
          </div>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
