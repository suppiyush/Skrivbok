/**
 * Pricing, for anyone — signed in or not.
 *
 * A payment provider reviewing the site needs to see what is sold and for how
 * much without creating an account, and so does anyone deciding whether to.
 * Every figure comes from `/public/plans`, the same list the plan page and
 * checkout use, so this page cannot quote a price that is not the one charged.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MarketingFooter,
  MarketingNav,
  Section,
  SectionHeading,
} from '../components/marketing/MarketingChrome';
import { Icon } from '../components/ui/Icon';
import { useAuth } from '../lib/auth';
import { rupees } from '../lib/format';
import { usePublicPlans } from '../lib/queries';

function Features({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-2">
          <span className="mt-px grid size-[18px] flex-none place-items-center rounded-full bg-brand-deep">
            <Icon name="check" size={12} className="text-white" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

const CTA =
  'press mt-auto flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold transition';

export default function Pricing() {
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const { data, isPending, isError } = usePublicPlans();
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');

  const monthly = data?.plans.find((p) => p.id === 'MONTHLY');
  const yearly = data?.plans.find((p) => p.id === 'YEARLY');
  const chosen = cycle === 'YEARLY' ? yearly : monthly;
  const unit = cycle === 'YEARLY' ? 'year' : 'month';

  // Only said when it is true for the prices actually configured.
  const saving =
    monthly && yearly && monthly.amountPaise * 12 > yearly.amountPaise
      ? rupees(monthly.amountPaise * 12 - yearly.amountPaise)
      : null;

  const limit = (n: number | undefined, noun: string) =>
    n === undefined ? `Limited ${noun}` : n < 0 ? `Unlimited ${noun}` : `Up to ${n} ${noun}`;

  return (
    <div className="min-h-screen bg-canvas-alt">
      <MarketingNav isSignedIn={signedIn} />
      <main>
        <Section className="py-16">
          <div className="mx-auto max-w-[680px] text-center">
            <SectionHeading lead="Simple" accent="pricing" center />
            <p className="mt-3 text-[16px] leading-relaxed text-ink-3">
              Start free and stay free for as long as you like. When you need more, buy PRO for a
              month or a year — a single payment, with no automatic renewal.
            </p>
          </div>

          {isError ? (
            <p role="status" className="mt-8 text-center text-[14px] text-danger-ink">
              Prices could not be loaded just now. Please refresh the page.
            </p>
          ) : null}

          <div className="mt-10 flex justify-center">
            <div
              role="radiogroup"
              aria-label="PRO period"
              className="flex rounded-xl border border-line bg-surface p-1"
            >
              {(['MONTHLY', 'YEARLY'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={cycle === value}
                  onClick={() => setCycle(value)}
                  className={`press rounded-lg px-4 py-2 text-[14px] font-semibold transition ${
                    cycle === value ? 'bg-brand-deep text-white' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {value === 'YEARLY' ? '1 year' : '1 month'}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-8 grid max-w-[860px] gap-5 sm:grid-cols-2">
            <div className="flex flex-col rounded-[24px] border border-line bg-surface p-8">
              <h2 className="text-[18px] font-bold">Free</h2>
              <p className="mt-3 text-[40px] leading-none font-extrabold tracking-[-0.03em]">₹0</p>
              <p className="mt-2 text-[14px] text-ink-3">For as long as you like</p>
              <Features
                items={[
                  limit(data?.freeLimits.projects, 'projects'),
                  limit(data?.freeLimits.careerGoals, 'career goals'),
                  limit(data?.freeLimits.literature, 'literature entries'),
                  'Unlimited ideas, notes, journal entries, deadlines and calendar events',
                  'Teammates, project meetings and shared calendars',
                  'Email reminders in your timezone',
                ]}
              />
              <div className="mt-8 flex flex-1 flex-col justify-end">
                <Link
                  to={signedIn ? '/dashboard' : '/register'}
                  className={`${CTA} border border-line-2 bg-surface text-ink hover:bg-surface-2`}
                >
                  {signedIn ? 'Go to your workspace' : 'Get started free'}
                </Link>
              </div>
            </div>

            <div className="flex flex-col rounded-[24px] border-2 border-brand bg-surface p-8">
              <h2 className="text-[18px] font-bold">PRO</h2>
              <p className="mt-3 text-[40px] leading-none font-extrabold tracking-[-0.03em]">
                {chosen ? rupees(chosen.amountPaise) : isPending ? '…' : '—'}
                <span className="text-[16px] font-semibold text-ink-3"> / {unit}</span>
              </p>
              <p className="mt-2 text-[14px] text-ink-3">
                One payment for one {unit} · pay again to continue
              </p>
              {cycle === 'YEARLY' && saving ? (
                <p className="mt-2 text-[13px] font-semibold text-brand-ink">
                  {saving} less than twelve monthly payments
                </p>
              ) : null}
              <Features
                items={[
                  'Everything in Free',
                  'Unlimited projects',
                  'Unlimited career goals',
                  'Unlimited literature entries',
                ]}
              />
              <div className="mt-8 flex flex-1 flex-col justify-end">
                <Link
                  to={signedIn ? '/upgrade' : '/register'}
                  className={`${CTA} bg-brand-deep text-white hover:brightness-110`}
                >
                  {signedIn ? 'Upgrade to PRO' : 'Sign up, then choose PRO'}
                </Link>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-[860px] rounded-[24px] bg-surface p-8 sm:p-10">
            <h2 className="text-[20px] font-bold tracking-[-0.01em]">How paying for PRO works</h2>
            <Features
              items={[
                'You pay once, securely through Razorpay. We never see your card, UPI or bank details.',
                'PRO is switched on as soon as the payment is confirmed — normally within minutes — and you receive a receipt by email.',
                `It lasts one month or one year from that moment. Your plan page shows the date it ends.`,
                'Nothing renews automatically. You are never charged again unless you choose to pay again.',
                'Paying again before PRO ends adds the new period on top, so no days are lost.',
                'When PRO ends, your account returns to Free. Everything you created is kept.',
                'Changed your mind? Ask within 7 days of paying for a full refund.',
              ]}
            />
            <p className="mt-6 text-[14px] leading-relaxed text-ink-3">
              Prices are in Indian Rupees. Full details are in our{' '}
              <Link to="/refund-policy" className="font-semibold text-brand-ink underline">
                Refund and Cancellation Policy
              </Link>
              ,{' '}
              <Link to="/shipping-policy" className="font-semibold text-brand-ink underline">
                Shipping and Delivery Policy
              </Link>{' '}
              and{' '}
              <Link to="/terms" className="font-semibold text-brand-ink underline">
                Terms and Conditions
              </Link>
              . Questions?{' '}
              <Link to="/contact" className="font-semibold text-brand-ink underline">
                Contact us
              </Link>
              .
            </p>
          </div>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
