/**
 * Server state.
 *
 * All reads and writes go through TanStack Query so that a mutation in one
 * place refreshes every view of the same data — creating a deadline updates
 * the deadlines list, the dashboard counters and the sidebar badge without any
 * screen knowing about the others.
 *
 * `resourceHooks` exists because the seven single-owner resources are the same
 * shape. Writing `useIdeas`, `useNotes`, `useJournal`… by hand would be seven
 * chances to forget an invalidation.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  admin,
  billing,
  calendar,
  careerGoals,
  deadlines,
  futureWork,
  ideas,
  journal,
  literature,
  meetings,
  notes,
  notifications,
  profile,
  projects,
  reports,
  reviews,
  uploadAvatar,
  type Paginated,
} from './api';

/**
 * Query keys.
 *
 * Grouped by resource so a mutation can invalidate everything derived from it
 * with one prefix, rather than listing each dependent key.
 */
export const keys = {
  ideas: ['ideas'] as const,
  notes: ['notes'] as const,
  journal: ['journal'] as const,
  deadlines: ['deadlines'] as const,
  futureWork: ['future-work'] as const,
  literature: ['literature'] as const,
  careerGoals: ['career-goals'] as const,
  projects: ['projects'] as const,
  calendar: ['calendar'] as const,
  meetings: ['meetings'] as const,
  notifications: ['notifications'] as const,
  profile: ['profile'] as const,
  billing: ['billing'] as const,
  reports: ['reports'] as const,
  reviews: ['reviews'] as const,
  admin: ['admin'] as const,
};

/** Everything the dashboard and sidebar derive from, refreshed after any write. */
const DERIVED = [keys.deadlines, keys.careerGoals, keys.billing, keys.notifications];

/* ── Generic resource hooks ───────────────────────────────────────────────── */

interface Client<T, TCreate, TUpdate> {
  list: (query?: Record<string, unknown>) => Promise<Paginated<T>>;
  create: (input: TCreate) => Promise<T>;
  update: (id: string, input: TUpdate) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export interface ResourceHooks<T, TCreate, TUpdate> {
  useList: (query: Record<string, unknown>) => UseQueryResult<Paginated<T>>;
  useCreate: () => UseMutationResult<T, Error, TCreate>;
  useUpdate: () => UseMutationResult<T, Error, { id: string; input: TUpdate }>;
  useRemove: () => UseMutationResult<void, Error, string>;
}

function resourceHooks<T, TCreate, TUpdate>(
  key: readonly string[],
  client: Client<T, TCreate, TUpdate>,
): ResourceHooks<T, TCreate, TUpdate> {
  /** After any write: this resource, plus anything that counts it. */
  function useInvalidate() {
    const qc = useQueryClient();
    return () => {
      void qc.invalidateQueries({ queryKey: key });
      for (const derived of DERIVED) void qc.invalidateQueries({ queryKey: derived });
    };
  }

  return {
    useList: (query) =>
      useQuery({
        queryKey: [...key, 'list', query],
        queryFn: () => client.list(query),
        // Keeps the previous page on screen while the next one loads, so
        // paging and typing in the search box do not blank the list.
        placeholderData: (previous) => previous,
      }),

    useCreate: () => {
      const invalidate = useInvalidate();
      return useMutation({ mutationFn: (input: TCreate) => client.create(input), onSuccess: invalidate });
    },

    useUpdate: () => {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: ({ id, input }: { id: string; input: TUpdate }) => client.update(id, input),
        onSuccess: invalidate,
      });
    },

    useRemove: () => {
      const invalidate = useInvalidate();
      return useMutation({ mutationFn: (id: string) => client.remove(id), onSuccess: invalidate });
    },
  };
}

export const ideaHooks = resourceHooks(keys.ideas, ideas);
export const noteHooks = resourceHooks(keys.notes, notes);
export const journalHooks = resourceHooks(keys.journal, journal);
export const deadlineHooks = resourceHooks(keys.deadlines, deadlines);
export const futureWorkHooks = resourceHooks(keys.futureWork, futureWork);
export const literatureHooks = resourceHooks(keys.literature, literature);
export const careerGoalHooks = resourceHooks(keys.careerGoals, careerGoals);
export const projectHooks = resourceHooks(keys.projects, projects);
export const eventHooks = resourceHooks(keys.calendar, calendar);

/* ── Aggregates and one-off endpoints ─────────────────────────────────────── */

export const useDeadlineSummary = () =>
  useQuery({ queryKey: [...keys.deadlines, 'summary'], queryFn: deadlines.summary });

export const useCareerSummary = () =>
  useQuery({ queryKey: [...keys.careerGoals, 'summary'], queryFn: careerGoals.summary });

export const useUsage = () =>
  useQuery({ queryKey: [...keys.billing, 'usage'], queryFn: billing.usage });

export const useSubscription = () =>
  useQuery({ queryKey: [...keys.billing, 'subscription'], queryFn: billing.subscription });

export const usePlans = () =>
  useQuery({ queryKey: [...keys.billing, 'plans'], queryFn: billing.plans, staleTime: 600_000 });

export const usePayments = (query: Record<string, unknown> = {}) =>
  useQuery({ queryKey: [...keys.billing, 'payments', query], queryFn: () => billing.payments(query) });

export const useIdeaCategories = () =>
  useQuery({ queryKey: [...keys.ideas, 'categories'], queryFn: ideas.categories });

export const useNoteCategories = () =>
  useQuery({ queryKey: [...keys.notes, 'categories'], queryFn: notes.categories });

export const useLiteratureTags = () =>
  useQuery({ queryKey: [...keys.literature, 'tags'], queryFn: literature.tags });

export const useJournalActivity = (from: string, to: string) =>
  useQuery({
    queryKey: [...keys.journal, 'activity', from, to],
    queryFn: () => journal.activity(from, to),
  });

export const useEventRange = (from: string, to: string) =>
  useQuery({
    queryKey: [...keys.calendar, 'range', from, to],
    queryFn: () => calendar.range(from, to),
  });

export const useProjectQuota = () =>
  useQuery({ queryKey: [...keys.projects, 'quota'], queryFn: projects.quota });

export const useCareerQuota = () =>
  useQuery({ queryKey: [...keys.careerGoals, 'quota'], queryFn: careerGoals.quota });

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: profile.get });

export const useProjectMembers = (id: string | null) =>
  useQuery({
    queryKey: [...keys.projects, id, 'members'],
    queryFn: () => projects.members(id as string),
    enabled: id !== null,
  });

/* ── Notifications ────────────────────────────────────────────────────────── */

export const useNotifications = (query: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: [...keys.notifications, 'list', query],
    queryFn: () => notifications.list(query),
    placeholderData: (previous) => previous,
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: [...keys.notifications, 'unread'],
    queryFn: notifications.unreadCount,
    // The badge is the one thing worth polling: it is how a user learns a
    // meeting request arrived without reloading.
    refetchInterval: 60_000,
  });

export function useNotificationActions() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: keys.notifications });

  return {
    markRead: useMutation({ mutationFn: (ids: string[]) => notifications.markRead(ids), onSuccess: invalidate }),
    markAllRead: useMutation({ mutationFn: () => notifications.markAllRead(), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => notifications.remove(id), onSuccess: invalidate }),
    clearRead: useMutation({ mutationFn: () => notifications.clearRead(), onSuccess: invalidate }),
  };
}

/* ── Meetings ─────────────────────────────────────────────────────────────── */

export const useMeetings = (query: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: [...keys.meetings, 'list', query],
    queryFn: () => meetings.list(query),
    placeholderData: (previous) => previous,
  });

export function useMeetingActions() {
  const qc = useQueryClient();
  // Accepting creates calendar events on both sides, so the calendar and the
  // notification badge both go stale at the same moment.
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.meetings });
    void qc.invalidateQueries({ queryKey: keys.calendar });
    void qc.invalidateQueries({ queryKey: keys.notifications });
  };

  return {
    create: useMutation({ mutationFn: meetings.create, onSuccess: invalidate }),
    accept: useMutation({ mutationFn: (id: string) => meetings.accept(id), onSuccess: invalidate }),
    decline: useMutation({ mutationFn: (id: string) => meetings.decline(id), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: (id: string) => meetings.cancel(id), onSuccess: invalidate }),
  };
}

/* ── Profile ──────────────────────────────────────────────────────────────── */

export function useProfileActions() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: keys.profile });

  return {
    save: useMutation({ mutationFn: profile.save, onSuccess: invalidate }),

    /**
     * The whole avatar change, as one mutation.
     *
     * Three steps that must all succeed to mean anything — sign, upload to the
     * provider, record the URL — so they belong in one operation with one
     * pending state and one failure, not three the screen has to sequence.
     */
    uploadAvatar: useMutation({
      mutationFn: async (file: File) => {
        const signature = await profile.avatarSignature();
        const url = await uploadAvatar(file, signature);
        return profile.setAvatar(url);
      },
      onSuccess: invalidate,
    }),

    clearAvatar: useMutation({ mutationFn: profile.clearAvatar, onSuccess: invalidate }),
  };
}

/* ── Reviews ──────────────────────────────────────────────────────────────── */

export const useOwnReview = () =>
  useQuery({ queryKey: [...keys.reviews, 'me'], queryFn: reviews.mine });

/** Approved reviews for the landing page. Public, so no session is needed. */
export const usePublishedReviews = () =>
  useQuery({
    queryKey: [...keys.reviews, 'published'],
    queryFn: reviews.published,
    staleTime: 300_000,
  });

export function useReviewActions() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: keys.reviews });

  return {
    save: useMutation({ mutationFn: reviews.save, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: () => reviews.remove(), onSuccess: invalidate }),
  };
}

/** Admin moderation. Invalidates the public list too, since approving publishes. */
export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      adminNote,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      adminNote?: string | null;
    }) => admin.moderateReview(id, { status, ...(adminNote ? { adminNote } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.admin });
      void qc.invalidateQueries({ queryKey: keys.reviews });
    },
  });
}

export const useAdminReviews = (query: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: [...keys.admin, 'reviews', query],
    queryFn: () => admin.reviews(query),
    placeholderData: (previous) => previous,
  });

/* ── Career goal stage movement ───────────────────────────────────────────── */

export function useAdvanceGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, description }: { id: string; description?: string }) =>
      careerGoals.advance(id, description),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.careerGoals }),
  });
}

/* ── Projects: members ────────────────────────────────────────────────────── */

/** Accepting an invitation, from the invitee's side. */
export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projects.acceptInvite(projectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.projects });
      // The invite notification is now answered, so the badge is stale.
      void qc.invalidateQueries({ queryKey: keys.notifications });
    },
  });
}

export function useProjectMemberActions(projectId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: keys.projects });

  return {
    add: useMutation({
      mutationFn: (input: { email: string; name?: string | null; role?: 'EDITOR' | 'VIEWER' }) =>
        projects.addMember(projectId as string, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (memberId: string) => projects.removeMember(projectId as string, memberId),
      onSuccess: invalidate,
    }),
  };
}

/* ── Reports ──────────────────────────────────────────────────────────────── */

export const useReports = (query: Record<string, unknown> = {}) =>
  useQuery({ queryKey: [...keys.reports, 'list', query], queryFn: () => reports.list(query) });

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reports.create,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.reports }),
  });
}

/* ── Admin ────────────────────────────────────────────────────────────────── */

export const useAdminStats = () =>
  useQuery({ queryKey: [...keys.admin, 'stats'], queryFn: admin.stats });

export const useAdminAnalytics = (days: number) =>
  useQuery({ queryKey: [...keys.admin, 'analytics', days], queryFn: () => admin.analytics(days) });

export const useAdminUsers = (query: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: [...keys.admin, 'users', query],
    queryFn: () => admin.users(query),
    placeholderData: (previous) => previous,
  });

export const useAdminPayments = (query: Record<string, unknown> = {}) =>
  useQuery({ queryKey: [...keys.admin, 'payments', query], queryFn: () => admin.payments(query) });

export const useAdminReports = (query: Record<string, unknown> = {}) =>
  useQuery({ queryKey: [...keys.admin, 'reports', query], queryFn: () => admin.reports(query) });
