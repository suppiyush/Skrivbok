/**
 * The workspace features, as the dashboard lists them.
 *
 * Shared rather than kept in `Dashboard.tsx`, because two places need to agree
 * on this list: the dashboard renders a card per entry, and the sidebar treats
 * every one of these routes as still being "in" the dashboard, so its nav item
 * stays lit while you are on one. Defined twice, the highlight would quietly
 * go wrong the first time a card was added or removed.
 *
 * It lives here and not next to the dashboard because the sidebar is the
 * dashboard's parent — `Dashboard.tsx` imports `AppShell`, so the shell
 * importing the dashboard back would be a cycle.
 *
 * Calendar is deliberately absent: it has its own sidebar entry, so it is not
 * one of the routes the dashboard stands in for. Account pages — Profile,
 * Settings, Help, Upgrade — are not workspace features at all.
 */
/**
 * A section's colour, in the six roles the coral fills product-wide.
 *
 * Each section is drawn in its own hue — the one its dashboard card wears —
 * and everything on its page that would otherwise be coral takes it instead:
 * the icon tile, the buttons, progress bars, sliders, the selected chip. The
 * six roles match the six `--color-brand-*` tokens one for one, so applying a
 * palette is a matter of overriding those variables on the page's region and
 * letting every `bg-brand`, `text-brand-ink` and so on resolve through them.
 *
 * The values are hand-picked rather than derived: each `ink` clears 4.5:1 on
 * white for text, each `deep` carries white text, and each `tint` is pale
 * enough for full-strength ink to sit on. A formula would get one of those
 * wrong for some hue.
 */
export interface Palette {
  /** The hue itself: bars, sliders, the chip you turned on. */
  brand: string;
  /** Text and links in the hue. */
  ink: string;
  /** An icon on the tint. */
  ink2: string;
  /** A filled button, with white text on it. */
  deep: string;
  /** The tile behind an icon; the row you selected. */
  tint: string;
  /** A band or panel, barely off the surface. */
  tint2: string;
}

export interface Feature {
  to: string;
  icon: string;
  /** Background of the icon tile. */
  tint: string;
  /** Colour of the icon itself. */
  fg: string;
  title: string;
  text: string;
  /** How the section's own page is coloured. */
  palette: Palette;
}

export const FEATURES: Feature[] = [
  {
    to: '/projects',
    icon: 'folder_open',
    tint: '#fdece0',
    fg: '#c2650b',
    title: 'Projects',
    text: 'Manage every project in one place — members, files, and progress.',
    palette: {
      brand: '#d9822b',
      ink: '#9a530a',
      ink2: '#c2650b',
      deep: '#8c4b09',
      tint: '#fdece0',
      tint2: '#fef6ee',
    },
  },
  {
    to: '/ideas',
    icon: 'lightbulb',
    tint: 'var(--color-accent-tint)',
    fg: 'var(--color-warn-ink)',
    title: 'Ideas',
    text: 'Capture brilliant ideas before they slip away, tagged and searchable.',
    palette: {
      brand: '#d9a21e',
      ink: '#7d6000',
      ink2: '#9a7300',
      deep: '#6f5500',
      tint: '#fff3d1',
      tint2: '#fff9e8',
    },
  },
  {
    to: '/notes',
    icon: 'sticky_note_2',
    tint: '#e0f5ee',
    fg: '#1f8a6f',
    title: 'Notes',
    text: 'Take quick notes on the fly and find them again in seconds.',
    palette: {
      brand: '#2e9c7e',
      ink: '#1a7059',
      ink2: '#1f8a6f',
      deep: '#155c49',
      tint: '#e0f5ee',
      tint2: '#eefaf5',
    },
  },
  {
    to: '/deadlines',
    icon: 'flag',
    tint: 'var(--color-danger-tint)',
    fg: 'var(--color-danger)',
    title: 'Deadlines',
    text: 'Stay ahead of every deadline with reminders and visual tracking.',
    palette: {
      brand: '#c9584a',
      ink: '#a03a2f',
      ink2: '#b4483c',
      deep: '#8a3228',
      tint: '#fdeceb',
      tint2: '#fef4f3',
    },
  },
  {
    to: '/future-work',
    icon: 'rocket_launch',
    tint: '#ffe9df',
    fg: '#e2572b',
    title: 'Future work',
    text: 'Plan what’s next and organise your pipeline of upcoming work.',
    palette: {
      brand: '#e2572b',
      ink: '#b3401b',
      ink2: '#c94a22',
      deep: '#98361a',
      tint: '#ffe9df',
      tint2: '#fff3ed',
    },
  },
  {
    to: '/literature',
    icon: 'menu_book',
    tint: '#e8eaff',
    fg: '#4f5bd5',
    title: 'Literature',
    text: 'Track papers and references, tagged and linked to your work.',
    palette: {
      brand: '#5a66d9',
      ink: '#3f4ab8',
      ink2: '#4f5bd5',
      deep: '#353f9e',
      tint: '#e8eaff',
      tint2: '#f2f3ff',
    },
  },
  {
    to: '/journal',
    icon: 'history_edu',
    tint: '#fdf1db',
    fg: '#a9720c',
    title: 'Journal',
    text: 'Keep a dated record of the work, written as it happens.',
    palette: {
      brand: '#c2861a',
      ink: '#8a5c08',
      ink2: '#a9720c',
      deep: '#744d06',
      tint: '#fdf1db',
      tint2: '#fef8ec',
    },
  },
  {
    to: '/meetings',
    icon: 'groups',
    tint: '#e3f7e9',
    fg: '#2f9e57',
    title: 'Meetings',
    text: 'Request, accept, and track meetings without the back and forth.',
    palette: {
      brand: '#3aa862',
      ink: '#227a46',
      ink2: '#2f9e57',
      deep: '#1e6a3c',
      tint: '#e3f7e9',
      tint2: '#eefbf2',
    },
  },
  {
    to: '/career-goals',
    icon: 'stairs',
    tint: '#f1e9fb',
    fg: '#7c4dbd',
    title: 'Career goals',
    text: 'Break long-term goals into stages you can actually track.',
    palette: {
      brand: '#8a5ccb',
      ink: '#6a3fa8',
      ink2: '#7c4dbd',
      deep: '#56338a',
      tint: '#f1e9fb',
      tint2: '#f7f2fd',
    },
  },
];

/** The routes the dashboard stands in for in the sidebar. */
export const FEATURE_PATHS: string[] = FEATURES.map((f) => f.to);

/**
 * Sections with a colour but no dashboard card. The calendar has its own
 * sidebar entry; its meetings share the meetings card's green.
 */
const OTHER_PALETTES: Record<string, Palette> = {
  '/calendar': {
    brand: '#1a95bd',
    ink: '#0f6f90',
    ink2: '#118ab2',
    deep: '#0c5a75',
    tint: '#dcf0f7',
    tint2: '#ecf7fb',
  },
};

/** The palette for a route, matched by prefix so `/projects/abc` is Projects. */
export function paletteFor(pathname: string): Palette | null {
  const feature = FEATURES.find((f) => pathname === f.to || pathname.startsWith(`${f.to}/`));
  if (feature) return feature.palette;

  const other = Object.keys(OTHER_PALETTES).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  return other ? (OTHER_PALETTES[other] ?? null) : null;
}

/**
 * A palette as the CSS variables the brand tokens read from. Set on an
 * element, everything inside it that was coral is drawn in the palette.
 */
export function accentVars(palette: Palette): Record<string, string> {
  return {
    '--color-brand': palette.brand,
    '--color-brand-ink': palette.ink,
    '--color-brand-ink-2': palette.ink2,
    '--color-brand-deep': palette.deep,
    '--color-brand-tint': palette.tint,
    '--color-brand-tint-2': palette.tint2,
  };
}
