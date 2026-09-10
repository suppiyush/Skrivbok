/**
 * Landing page chrome: navigation, footer, and the section primitives the
 * marketing page is built from.
 *
 * Matches `design/Skrivbok Landing.html`: a sticky bar that gains a border on
 * scroll, a black "Get Started" pill, and section headings where the final word
 * is picked out in blue over a hand-drawn underline.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';

const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Why Skrivbok', href: '#why' },
  { label: 'How it works', href: '#how' },
  { label: 'FAQ', href: '#faq' },
];

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="flex flex-none items-center gap-2.5 text-ink">
      {/* The supplied mark is a 1254px square with generous internal padding,
          so it is scaled up slightly against the wordmark to read at nav size. */}
      <img
        src="/assets/logo.png"
        alt=""
        width={size}
        height={size}
        className="flex-none object-contain"
        style={{ width: size * 1.15, height: size * 1.15, marginInline: size * -0.06 }}
      />
      <span className="text-[19px] font-extrabold tracking-[-0.03em]">
        Skrivbok<span className="text-brand">.</span>
      </span>
    </span>
  );
}

/** The hand-drawn underline that sits beneath an emphasised word. */
export function Underline({ color = 'var(--color-accent)' }: { color?: string }) {
  return (
    <svg
      className="absolute -bottom-1 left-0 w-full"
      height="10"
      viewBox="0 0 220 12"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M2 8 C 50 3, 90 9, 130 5 S 190 3, 218 7"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A heading with its last phrase emphasised, as used across the landing page. */
export function SectionHeading({
  lead,
  accent,
  accentColor = 'var(--color-brand)',
  underline = 'var(--color-accent)',
  center = false,
}: {
  lead: string;
  accent: string;
  accentColor?: string;
  underline?: string;
  center?: boolean;
}) {
  return (
    <h2
      className={`pb-3 text-[clamp(28px,4vw,40px)] font-extrabold leading-[1.12] tracking-[-0.035em] ${
        center ? 'text-center' : ''
      }`}
    >
      {lead}{' '}
      <span className="relative inline-block" style={{ color: accentColor }}>
        {accent}
        <Underline color={underline} />
      </span>
    </h2>
  );
}

export function MarketingNav({ isSignedIn = false }: { isSignedIn?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors ${
        scrolled
          ? 'border-b border-line bg-canvas-alt/90 backdrop-blur'
          : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 px-5">
        <Link to="/" aria-label="Skrivbok home">
          <Logo size={30} />
        </Link>

        <nav className="mx-auto hidden items-center gap-8 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-[14.5px] font-semibold text-ink-2 transition hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {isSignedIn ? (
            <Link to="/dashboard">
              <Button variant="primary" size="sm" className="!rounded-full !px-5">
                Open Skrivbok
              </Button>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden px-3 text-[14.5px] font-semibold text-ink-2 hover:text-ink sm:block"
              >
                Log In
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm" className="!rounded-full !px-5">
                  Get Started
                </Button>
              </Link>
            </>
          )}
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 lg:hidden"
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          className="border-t border-line bg-surface px-5 py-3 lg:hidden"
          aria-label="Primary, mobile"
        >
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl px-3 py-3 text-[15px] font-semibold text-ink-2 hover:bg-surface-2"
            >
              {n.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

/** Placeholder for artwork the design references but which has not been supplied. */
export function ArtPlaceholder({
  label,
  ratio = '4 / 3',
  icon,
  className = '',
}: {
  label: string;
  ratio?: string;
  icon?: string;
  className?: string;
}) {
  return (
    <div
      className={`art-placeholder rounded-3xl ${className}`}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={label}
    >
      <span className="flex flex-col items-center gap-2">
        {icon ? <Icon name={icon} size={26} className="text-brand" /> : null}
        {label}
      </span>
    </div>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Logo size={30} />
          <p className="mt-4 max-w-[42ch] text-[14px] leading-relaxed text-ink-3">
            A workspace for academic research — projects, deadlines, literature, ideas, calendar and
            career goals in one place.
          </p>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { label: 'Features', href: '#features' },
            { label: 'Why Skrivbok', href: '#why' },
            { label: 'How it works', href: '#how' },
            { label: 'FAQ', href: '#faq' },
            { label: 'Sign in', href: '/login', internal: true },
          ]}
        />

        <FooterColumn
          title="Company"
          links={[
            { label: 'Contact', href: '/contact', internal: true },
            { label: 'Privacy Policy', href: '/privacy-policy', internal: true },
            { label: 'Terms of Service', href: '/terms', internal: true },
            { label: 'End User Agreement', href: '/end-user-agreement', internal: true },
            { label: 'Refund Policy', href: '/refund-policy', internal: true },
          ]}
        />
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-[1200px] px-5 py-5 text-[13px] text-ink-3">
          © {year} Skrivbok. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; internal?: boolean }[];
}) {
  return (
    <div>
      <h3 className="text-[13px] font-bold tracking-[0.06em] text-ink-4 uppercase">{title}</h3>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.label}>
            {l.internal ? (
              <Link to={l.href} className="text-[14px] text-ink-3 hover:text-ink">
                {l.label}
              </Link>
            ) : (
              <a href={l.href} className="text-[14px] text-ink-3 hover:text-ink">
                {l.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Section({
  id,
  children,
  className = '',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`mx-auto w-full max-w-[1200px] px-5 ${className}`}>
      {children}
    </section>
  );
}
