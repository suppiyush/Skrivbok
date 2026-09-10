/**
 * API client.
 *
 * One place that knows how to talk to the backend. Two things it guarantees:
 *
 *  1. `credentials: 'include'` on every request — the session is an httpOnly
 *     cookie, so nothing here ever handles a token.
 *  2. Errors arrive as a typed `ApiError` carrying the backend's stable `code`
 *     and its per-field `details`, so screens branch on the code and render
 *     field errors inline rather than parsing a message string.
 *
 * The resource sections below mirror `apps/server/src/modules` one-for-one.
 * Every list endpoint returns the same `Paginated<T>` envelope, which is what
 * lets the app have a single list screen instead of seven.
 */
const BASE = '/api/v1';

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldIssue[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The message for one field, e.g. `fieldError('email')` on a register form. */
  fieldError(field: string): string | undefined {
    return this.details.find((d) => d.path === `body.${field}` || d.path === field)?.message;
  }

  /** Field errors keyed by name, ready to drop into form state. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(
      this.details.map((d) => [d.path.replace(/^body\./, ''), d.message]),
    );
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Built by assignment rather than by spreading optional values: with
  // `exactOptionalPropertyTypes`, an explicit `undefined` is not the same as an
  // absent key, and `fetch` wants the key absent.
  const options: RequestInit = { credentials: 'include', ...init };
  if (init.body !== undefined && init.body !== null) {
    options.headers = { 'Content-Type': 'application/json', ...init.headers };
  }

  const response = await fetch(`${BASE}${path}`, options);

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const err =
      payload && typeof payload === 'object' && 'error' in payload
        ? (
            payload as {
              error: { code: string; message: string; details?: FieldIssue[]; requestId?: string };
            }
          ).error
        : null;

    throw new ApiError(
      response.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Something went wrong',
      err?.details ?? [],
      err?.requestId,
    );
  }

  return payload as T;
}

const body = (data: unknown) => JSON.stringify(data);

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(
      path,
      data === undefined ? { method: 'POST' } : { method: 'POST', body: body(data) },
    ),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: body(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: body(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/**
 * Build a query string, dropping empty values.
 *
 * An empty search box must not send `search=`, which the backend rejects as
 * a zero-length string rather than treating as "no filter".
 */
export function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item !== '') search.append(key, String(item));
    } else {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

/* ── Shared types, mirroring the backend ──────────────────────────────────── */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type DeadlineStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type NoteColor = 'YELLOW' | 'PINK' | 'BLUE' | 'GREEN' | 'PURPLE' | 'ORANGE' | 'GRAY';
export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type MeetingStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
export type EventVisibility = 'PRIVATE' | 'BUSY' | 'PUBLIC';
export type Recurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO';
  timezone: string;
  subscriptionEndsAt: string | null;
  createdAt: string;
}

export interface MeResponse extends User {
  /** Linked identity providers. Always `['GOOGLE']` for accounts created here. */
  providers: string[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: PageMeta;
}

/** What the backend reports for a free-plan capped resource. */
export interface LimitStatus {
  limited: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface Idea {
  id: string;
  title: string;
  content: string | null;
  category: string;
  color: NoteColor;
  createdAt: string;
  updatedAt: string;
}

export interface Note extends Idea {
  pinned: boolean;
}

export interface JournalEntry {
  id: string;
  title: string | null;
  content: string;
  entryDate: string;
  mood: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Deadline {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  timezone: string;
  priority: Priority;
  status: DeadlineStatus;
  reminderEnabled: boolean;
  remindAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FutureWork {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  timeline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Literature {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  links: string[];
  tags: string[];
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareerGoal {
  id: string;
  title: string;
  description: string | null;
  goalType: string;
  totalStages: number;
  currentStage: number;
  stageDescription: string | null;
  startAt: string | null;
  targetAt: string | null;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  email: string;
  name: string | null;
  role: ProjectRole;
  userId: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  progress: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
  owner?: { id: string; name: string | null; email: string };
  /** List responses carry the caller's own membership, so a card can decide
   *  what to enable without fetching the full member list per project. */
  memberCount?: number;
  myRole?: ProjectRole;
  invitePending?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  isAllDay: boolean;
  category: string;
  priority: Priority;
  showAs: 'FREE' | 'BUSY' | 'TENTATIVE' | 'OUT_OF_OFFICE';
  visibility: EventVisibility;
  isOnline: boolean;
  meetingLink: string | null;
  attendees: string[];
  reminderMinutes: number | null;
  recurrence: Recurrence;
  recurrenceEndAt: string | null;
  meetingRequestId: string | null;
  /** Set on redacted occurrences returned from a shared calendar. */
  redacted?: boolean;
}

export interface MeetingRequest {
  id: string;
  senderId: string;
  receiverId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  status: MeetingStatus;
  respondedAt: string | null;
  createdAt: string;
  sender?: { id: string; name: string | null; email: string };
  receiver?: { id: string; name: string | null; email: string };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  avatarUrl: string | null;
  fullName: string | null;
  designation: string | null;
  department: string | null;
  institution: string | null;
  officialEmail: string | null;
  phone: string | null;
  website: string | null;
  scholarLink: string | null;
  researchKeywords: string | null;
  researchDescription: string | null;
  updatedAt: string;
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** The caller's own review, including why it was rejected. */
export interface OwnReview {
  id: string;
  rating: number;
  role: string | null;
  body: string;
  status: ReviewStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the landing page renders. Deliberately carries no identifiers. */
export interface PublicReview {
  id: string;
  rating: number;
  role: string | null;
  body: string;
  createdAt: string;
  user: { name: string | null; profile: { avatarUrl: string | null } | null };
}

/** One admin queue row. */
export interface AdminReview extends OwnReview {
  user: { id: string; name: string | null; email: string };
  reviewedAt: string | null;
}

/** What the client needs to upload straight to the storage provider. */
export interface UploadSignature {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  transformation: string;
}

export interface Payment {
  id: string;
  provider: string;
  amountPaise: number;
  currency: string;
  status: string;
  plan: string | null;
  createdAt: string;
}

export interface Report {
  id: string;
  type: string;
  featurePage: string | null;
  title: string | null;
  description: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

/* ── Auth ─────────────────────────────────────────────────────────────────── */

/**
 * Google is the only sign-in method, so there is nothing here to sign in with:
 * the browser leaves for `/api/v1/auth/google` and comes back holding a session
 * cookie. Everything below operates on a session that already exists.
 */
export const auth = {
  config: () => api.get<{ googleEnabled: boolean }>('/auth/config'),
  me: () => api.get<{ user: MeResponse }>('/auth/me'),
  logout: () => api.post<void>('/auth/logout'),
  logoutAll: () => api.post<{ revokedSessions: number }>('/auth/logout-all'),
  updateMe: (input: { name?: string; timezone?: string }) =>
    api.patch<{ user: MeResponse }>('/auth/me', input),
};

/* ── Generic CRUD resource ────────────────────────────────────────────────── */

/**
 * Every user-owned resource exposes the same five operations at the same
 * paths, so they are generated rather than written out seven times. A resource
 * with extra endpoints (deadlines, projects) extends the object it returns.
 */
function resource<T, TCreate, TUpdate = Partial<TCreate>>(path: string) {
  return {
    list: (query: Record<string, unknown> = {}) => api.get<Paginated<T>>(`${path}${qs(query)}`),
    get: (id: string) => api.get<T>(`${path}/${id}`),
    create: (input: TCreate) => api.post<T>(path, input),
    update: (id: string, input: TUpdate) => api.patch<T>(`${path}/${id}`, input),
    remove: (id: string) => api.delete<void>(`${path}/${id}`),
  };
}

export const ideas = {
  ...resource<Idea, { title: string; content?: string | null; category?: string; color?: NoteColor }>(
    '/ideas',
  ),
  categories: () => api.get<{ categories: string[] }>('/ideas/categories'),
};

export const notes = {
  ...resource<
    Note,
    { title: string; content?: string | null; category?: string; color?: NoteColor; pinned?: boolean }
  >('/notes'),
  categories: () => api.get<{ categories: string[] }>('/notes/categories'),
};

export const journal = {
  ...resource<
    JournalEntry,
    { title?: string | null; content: string; entryDate?: string; mood?: string | null }
  >('/journal'),
  activity: (from: string, to: string) =>
    api.get<{ activity: { date: string; count: number }[] }>(`/journal/activity${qs({ from, to })}`),
};

export const deadlines = {
  ...resource<
    Deadline,
    {
      title: string;
      description?: string | null;
      dueAt: string;
      timezone?: string;
      priority?: Priority;
      status?: DeadlineStatus;
      reminderEnabled?: boolean;
    }
  >('/deadlines'),
  summary: () =>
    api.get<{ total: number; open: number; overdue: number; dueThisWeek: number; completed: number }>(
      '/deadlines/summary',
    ),
};

export const futureWork = resource<
  FutureWork,
  { title: string; description?: string | null; priority?: Priority; timeline?: string | null }
>('/future-work');

export const literature = {
  ...resource<
    Literature,
    {
      title: string;
      authors?: string | null;
      year?: number | null;
      links?: string[];
      tags?: string[];
      summary?: string | null;
    }
  >('/literature'),
  tags: () => api.get<{ tags: { tag: string; count: number }[] }>('/literature/tags'),
};

export const careerGoals = {
  ...resource<
    CareerGoal,
    {
      title: string;
      description?: string | null;
      goalType?: string;
      totalStages?: number;
      currentStage?: number;
      stageDescription?: string | null;
      startAt?: string | null;
      targetAt?: string | null;
    }
  >('/career-goals'),
  quota: () => api.get<LimitStatus>('/career-goals/quota'),
  summary: () =>
    api.get<{ total: number; active: number; achieved: number; averageProgress: number }>(
      '/career-goals/summary',
    ),
  advance: (id: string, description?: string) =>
    api.post<CareerGoal>(`/career-goals/${id}/advance`, { description: description ?? null }),
};

export const projects = {
  ...resource<
    Project,
    { name: string; description?: string | null; progress?: number },
    { name?: string; description?: string | null; progress?: number; archived?: boolean }
  >('/projects'),
  quota: () => api.get<LimitStatus>('/projects/quota'),
  members: (id: string) => api.get<{ members: ProjectMember[] }>(`/projects/${id}/members`),
  addMember: (id: string, input: { email: string; name?: string | null; role?: 'EDITOR' | 'VIEWER' }) =>
    api.post<ProjectMember>(`/projects/${id}/members`, input),
  /** The invitee accepting their own invitation. Not an owner action. */
  acceptInvite: (id: string) => api.post<ProjectMember>(`/projects/${id}/members/accept`),
  removeMember: (id: string, memberId: string) =>
    api.delete<void>(`/projects/${id}/members/${memberId}`),
};

/* ── Calendar ─────────────────────────────────────────────────────────────── */

export const calendar = {
  ...resource<
    CalendarEvent,
    {
      title: string;
      description?: string | null;
      location?: string | null;
      startAt: string;
      endAt: string;
      timezone?: string;
      isAllDay?: boolean;
      category?: string;
      priority?: Priority;
      visibility?: EventVisibility;
      isOnline?: boolean;
      meetingLink?: string | null;
      attendees?: string[];
      reminderMinutes?: number | null;
      recurrence?: Recurrence;
      recurrenceEndAt?: string | null;
    }
  >('/calendar/events'),
  /** Expanded occurrences between two instants — what the month grid renders. */
  range: (from: string, to: string) =>
    api.get<{ events: CalendarEvent[] }>(`/calendar/events/range${qs({ from, to })}`),
  categories: () => api.get<{ categories: string[] }>('/calendar/events/categories'),
};

export const meetings = {
  list: (query: Record<string, unknown> = {}) =>
    api.get<Paginated<MeetingRequest>>(`/calendar/meeting-requests${qs(query)}`),
  create: (input: {
    receiverEmail: string;
    title: string;
    description?: string | null;
    startAt: string;
    endAt: string;
    timezone?: string;
  }) => api.post<MeetingRequest>('/calendar/meeting-requests', input),
  accept: (id: string) => api.post<MeetingRequest>(`/calendar/meeting-requests/${id}/accept`),
  decline: (id: string) => api.post<MeetingRequest>(`/calendar/meeting-requests/${id}/decline`),
  cancel: (id: string) => api.post<MeetingRequest>(`/calendar/meeting-requests/${id}/cancel`),
};

/* ── Account ──────────────────────────────────────────────────────────────── */

export const notifications = {
  list: (query: Record<string, unknown> = {}) =>
    api.get<Paginated<Notification>>(`/notifications${qs(query)}`),
  unreadCount: () => api.get<{ unreadCount: number }>('/notifications/unread-count'),
  markRead: (ids: string[]) => api.post<{ marked: number }>('/notifications/read', { ids }),
  markAllRead: () => api.post<{ marked: number }>('/notifications/read-all'),
  remove: (id: string) => api.delete<void>(`/notifications/${id}`),
  clearRead: () => api.delete<{ deleted: number }>('/notifications/read'),
};

export const profile = {
  get: () => api.get<{ profile: Profile | null; uploadsEnabled: boolean }>('/profile'),
  save: (input: Partial<Profile>) => api.put<{ profile: Profile }>('/profile', input),

  /** Step one of an avatar change: ask the server to sign the upload. */
  avatarSignature: () => api.post<UploadSignature>('/profile/avatar/signature'),
  /** Step three: tell the server where the provider put it. */
  setAvatar: (url: string) => api.put<{ profile: Profile }>('/profile/avatar', { url }),
  clearAvatar: () => api.delete<{ profile: Profile }>('/profile/avatar'),
};

/**
 * Step two of an avatar change: the browser POSTs the file straight to the
 * storage provider. It deliberately does not go through our API — the JSON
 * body limit is 1MB, and raising it for one endpoint raises it for all of them.
 */
export async function uploadAvatar(file: File, signature: UploadSignature): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('folder', signature.folder);
  form.append('public_id', 'avatar');
  form.append('overwrite', 'true');
  form.append('transformation', signature.transformation);

  const response = await fetch(signature.uploadUrl, { method: 'POST', body: form });
  if (!response.ok) throw new Error('The image could not be uploaded. Try a different file.');

  const payload = (await response.json()) as { secure_url?: string };
  if (!payload.secure_url) throw new Error('The upload succeeded but returned no image URL.');
  return payload.secure_url;
}

export const reviews = {
  mine: () => api.get<{ review: OwnReview | null }>('/reviews/me'),
  save: (input: { rating: number; role?: string | null; body: string }) =>
    api.put<{ review: OwnReview }>('/reviews/me', input),
  remove: () => api.delete<void>('/reviews/me'),
  /** Approved reviews. No session required — this is the landing page's source. */
  published: () => api.get<{ reviews: PublicReview[] }>('/public/reviews'),
};

export const billing = {
  plans: () =>
    api.get<{
      currency: string;
      plans: { id: 'MONTHLY' | 'YEARLY'; amountPaise: number; amountDisplay: string }[];
    }>('/billing/plans'),
  subscription: () =>
    api.get<{
      plan: 'FREE' | 'PRO';
      subscriptionEndsAt: string | null;
      billingEnabled: boolean;
    }>('/billing/subscription'),
  usage: () =>
    api.get<{ projects: LimitStatus; careerGoals: LimitStatus; literature: LimitStatus }>(
      '/billing/usage',
    ),
  payments: (query: Record<string, unknown> = {}) =>
    api.get<Paginated<Payment>>(`/billing/payments${qs(query)}`),
};

export const reports = {
  list: (query: Record<string, unknown> = {}) => api.get<Paginated<Report>>(`/reports${qs(query)}`),
  create: (input: {
    type: 'BUG' | 'FEATURE' | 'FEEDBACK';
    featurePage?: string | null;
    title?: string | null;
    description: string;
  }) => api.post<Report>('/reports', input),
};

/* ── Admin ────────────────────────────────────────────────────────────────── */

export interface PlatformStats {
  users: {
    total: number;
    pro: number;
    free: number;
    admins: number;
    newThisWeek: number;
    activeThisWeek: number;
  };
  content: Record<string, number>;
  revenue: {
    capturedPaise: number;
    capturedCount: number;
    failedCount: number;
    refundedCount: number;
  };
  engagement: { withProjects: number; withProfile: number; neverLoggedIn: number };
}

export const admin = {
  stats: () => api.get<PlatformStats>('/admin/stats'),
  analytics: (days = 30) =>
    api.get<{
      days: number;
      signups: { date: string; count: number }[];
      revenue: { date: string; amountPaise: number }[];
      activeUsers: { date: string; count: number }[];
      featureAdoption: Record<string, number>;
    }>(`/admin/analytics${qs({ days })}`),
  users: (query: Record<string, unknown> = {}) =>
    api.get<Paginated<User & { lastLoginAt: string | null }>>(`/admin/users${qs(query)}`),
  payments: (query: Record<string, unknown> = {}) =>
    api.get<Paginated<Payment & { user?: { email: string; name: string | null } }>>(
      `/admin/payments${qs(query)}`,
    ),
  reviews: (query: Record<string, unknown> = {}) =>
    api.get<Paginated<AdminReview>>(`/admin/reviews${qs(query)}`),
  moderateReview: (id: string, input: { status: 'APPROVED' | 'REJECTED'; adminNote?: string | null }) =>
    api.patch<{ review: OwnReview }>(`/admin/reviews/${id}`, input),
  reports: (query: Record<string, unknown> = {}) =>
    api.get<Paginated<Report & { user?: { email: string; name: string | null } }>>(
      `/admin/reports${qs(query)}`,
    ),
};

/** Coarse public counters for the marketing page. */
export const publicStats = () =>
  api.get<{ users: number; projects: number; ideas: number; careerGoals: number }>('/public/stats');
