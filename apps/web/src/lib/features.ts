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
export interface Feature {
  to: string;
  icon: string;
  /** Background of the icon tile. */
  tint: string;
  /** Colour of the icon itself. */
  fg: string;
  title: string;
  text: string;
}

export const FEATURES: Feature[] = [
  {
    to: '/projects',
    icon: 'folder_open',
    tint: '#fdece0',
    fg: '#c2650b',
    title: 'Projects',
    text: 'Manage every project in one place — members, files, and progress.',
  },
  {
    to: '/ideas',
    icon: 'lightbulb',
    tint: 'var(--color-accent-tint)',
    fg: 'var(--color-warn-ink)',
    title: 'Ideas',
    text: 'Capture brilliant ideas before they slip away, tagged and searchable.',
  },
  {
    to: '/notes',
    icon: 'sticky_note_2',
    tint: '#e0f5ee',
    fg: '#1f8a6f',
    title: 'Notes',
    text: 'Take quick notes on the fly and find them again in seconds.',
  },
  {
    to: '/deadlines',
    icon: 'flag',
    tint: 'var(--color-danger-tint)',
    fg: 'var(--color-danger)',
    title: 'Deadlines',
    text: 'Stay ahead of every deadline with reminders and visual tracking.',
  },
  {
    to: '/future-work',
    icon: 'rocket_launch',
    tint: '#ffe9df',
    fg: '#e2572b',
    title: 'Future work',
    text: 'Plan what’s next and organise your pipeline of upcoming work.',
  },
  {
    to: '/literature',
    icon: 'menu_book',
    tint: '#e8eaff',
    fg: '#4f5bd5',
    title: 'Literature',
    text: 'Track papers and references, tagged and linked to your work.',
  },
  {
    to: '/journal',
    icon: 'history_edu',
    tint: '#fdf1db',
    fg: '#a9720c',
    title: 'Journal',
    text: 'Keep a dated record of the work, written as it happens.',
  },
  {
    to: '/meetings',
    icon: 'groups',
    tint: '#e3f7e9',
    fg: '#2f9e57',
    title: 'Meetings',
    text: 'Request, accept, and track meetings without the back and forth.',
  },
  {
    to: '/career-goals',
    icon: 'stairs',
    tint: '#f1e9fb',
    fg: '#7c4dbd',
    title: 'Career goals',
    text: 'Break long-term goals into stages you can actually track.',
  },
];

/** The routes the dashboard stands in for in the sidebar. */
export const FEATURE_PATHS: string[] = FEATURES.map((f) => f.to);
