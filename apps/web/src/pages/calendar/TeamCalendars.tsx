/**
 * Teammates' calendars: asking, answering, and choosing whose to show.
 *
 * Everything about sharing lives in one dialog behind the calendar's Team
 * button, in the order a person meets it: the calendars they can already see
 * (and a checkbox to lay each over their own), anyone asking to see theirs,
 * a form to ask a teammate, requests still waiting, and who can see theirs.
 *
 * "Teammate" means someone they share a project with — the same list the
 * meet requests use. What a teammate sees once in is the server's decision:
 * anything that involves them in full, everything else as Busy.
 */
import { useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Select, Textarea } from '../../components/ui/Form';
import { Icon } from '../../components/ui/Icon';
import { Pill } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ApiError, type CalendarAccessLevel } from '../../lib/api';
import {
  useAccessActions,
  useAccessRequests,
  useHeldCalendars,
  useMeetContacts,
  useSharedWithOthers,
} from '../../lib/queries';
import { PersonAvatar } from '../../components/ui/Person';
import { personColour } from '../../lib/people';

const LEVEL_LABEL: Record<CalendarAccessLevel, string> = {
  FREE_BUSY: 'Busy times',
  VIEW: 'Busy times + public details',
};

/** The header button. Carries a count when someone is waiting on an answer. */
export function TeamButton({ onClick }: { onClick: () => void }) {
  const incoming = useAccessRequests({ box: 'incoming', status: 'PENDING', limit: 1 });
  const waiting = incoming.data?.pagination.total ?? 0;

  return (
    <Button variant="secondary" size="sm" icon="groups" onClick={onClick}>
      Team
      {waiting > 0 ? (
        <span
          aria-label={`${waiting} waiting`}
          className="grid h-4 min-w-4 place-items-center rounded-full bg-danger-strong px-1 text-[10px] font-bold text-white tabular"
        >
          {waiting}
        </span>
      ) : null}
    </Button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11.5px] font-bold tracking-[0.08em] text-ink-4 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-ink-3">{children}</p>;
}

function Person({ name, email }: { name: string | null; email: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <PersonAvatar name={name} email={email} />
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold text-ink">{name ?? email}</span>
        {name ? <span className="block truncate text-[12px] text-ink-3">{email}</span> : null}
      </span>
    </span>
  );
}

export function TeamDialog({
  onClose,
  shown,
  onToggle,
}: {
  onClose: () => void;
  /** Emails of the teammates whose calendars are laid over the user's. */
  shown: string[];
  onToggle: (email: string) => void;
}) {
  const toast = useToast();
  const held = useHeldCalendars();
  const granted = useSharedWithOthers();
  const incoming = useAccessRequests({ box: 'incoming', status: 'PENDING', limit: 50 });
  const outgoing = useAccessRequests({ box: 'outgoing', status: 'PENDING', limit: 50 });
  const contacts = useMeetContacts();
  const { request, approve, reject, withdraw, update, revoke } = useAccessActions();

  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const [withDetails, setWithDetails] = useState<Record<string, boolean>>({});

  const canSee = held.data?.grants ?? [];
  const seeMine = granted.data?.grants ?? [];
  const asking = incoming.data?.data ?? [];
  const waiting = outgoing.data?.data ?? [];

  // Nobody is offered twice: not someone whose calendar is already visible,
  // and not someone already asked.
  const taken = new Set([
    ...canSee.map((g) => g.owner.email),
    ...waiting.map((r) => r.target.email),
  ]);
  const everyone = contacts.data?.contacts ?? [];
  const askable = everyone.filter((c) => !taken.has(c.email));
  const chosen = askable.some((c) => c.email === target) ? target : (askable[0]?.email ?? '');

  function run(promise: Promise<unknown>, success: string) {
    void promise
      .then(() => toast.success(success))
      .catch((err: unknown) =>
        toast.error(err instanceof ApiError ? err.message : 'That did not work. Try again.'),
      );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Team calendars"
      description="Ask a teammate to share their calendar, then show it beside yours. Anything of theirs that does not include you appears only as Busy."
    >
      <div className="flex flex-col gap-6">
        <Group title="Calendars you can see">
          {canSee.length > 0 ? (
            <p className="-mt-1 mb-2 text-[12.5px] leading-relaxed text-ink-3">
              A shown calendar is laid over yours in its colour. You can also switch people on and
              off from the row above the calendar.
            </p>
          ) : null}
          {held.isPending ? (
            <Quiet>Loading…</Quiet>
          ) : canSee.length === 0 ? (
            <Quiet>No one has shared their calendar with you yet.</Quiet>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {canSee.map((grant) => {
                const name = grant.owner.name ?? grant.owner.email;
                const on = shown.includes(grant.owner.email);
                return (
                  <li
                    key={grant.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 flex-none rounded-full"
                      style={{ background: personColour(grant.owner.email).solid }}
                    />
                    <Person name={grant.owner.name} email={grant.owner.email} />
                    <Pill>{LEVEL_LABEL[grant.level]}</Pill>
                    <ShowToggle
                      on={on}
                      colour={personColour(grant.owner.email).solid}
                      label={`Show ${name}'s calendar on mine`}
                      onClick={() => onToggle(grant.owner.email)}
                    >
                      {on ? 'Shown on my calendar' : 'Show on my calendar'}
                    </ShowToggle>
                    <button
                      type="button"
                      aria-label={`Stop seeing ${name}'s calendar`}
                      title="Stop seeing this calendar"
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (on) onToggle(grant.owner.email);
                        run(revoke.mutateAsync(grant.id), `You no longer see ${name}'s calendar`);
                      }}
                      className="press grid size-8 flex-none place-items-center rounded-lg text-ink-4 transition hover:bg-surface-2 hover:text-danger disabled:opacity-50"
                    >
                      <Icon name="close" size={17} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Group>

        {asking.length > 0 ? (
          <Group title="Asking to see yours">
            <ul className="flex flex-col gap-2">
              {asking.map((r) => {
                const name = r.requester.name ?? r.requester.email;
                return (
                  <li key={r.id} className="rounded-xl border border-line p-3">
                    <Person name={r.requester.name} email={r.requester.email} />
                    {r.message ? (
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-3 italic">
                        “{r.message}”
                      </p>
                    ) : null}
                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
                      They will see when you are busy. Anything that includes them — an event they
                      are invited to, a meeting with them — they will see in full.
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-2">
                      <input
                        type="checkbox"
                        checked={withDetails[r.id] ?? false}
                        onChange={(e) =>
                          setWithDetails((current) => ({ ...current, [r.id]: e.target.checked }))
                        }
                        className="size-4 accent-[var(--color-brand)]"
                      />
                      Also show them the details of events I mark Public
                    </label>
                    <div className="mt-2.5 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={reject.isPending || approve.isPending}
                        onClick={() => run(reject.mutateAsync(r.id), 'Request declined')}
                      >
                        Decline
                      </Button>
                      <Button
                        variant="brand"
                        size="sm"
                        icon="check"
                        disabled={reject.isPending || approve.isPending}
                        onClick={() =>
                          run(
                            approve.mutateAsync({
                              id: r.id,
                              level: withDetails[r.id] ? 'VIEW' : 'FREE_BUSY',
                            }),
                            `${name} can now see your calendar`,
                          )
                        }
                      >
                        Share my calendar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Group>
        ) : null}

        <Group title="Ask a teammate">
          {contacts.isPending ? (
            <Quiet>Loading your teammates…</Quiet>
          ) : askable.length === 0 ? (
            <Quiet>
              {everyone.length === 0
                ? 'Teammates are the people you share a project with. Add someone to a project to ask for their calendar.'
                : 'You have already asked everyone you share a project with.'}
            </Quiet>
          ) : (
            <div className="flex flex-col gap-3">
              <Select
                label="Teammate"
                value={chosen}
                onChange={(e) => setTarget(e.target.value)}
                options={askable.map((c) => ({
                  value: c.email,
                  label: c.name ? `${c.name} (${c.email})` : c.email,
                }))}
              />
              <Textarea
                label="Message (optional)"
                rows={2}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="So I can find a time for our meetings"
              />
              <div className="flex justify-end">
                <Button
                  variant="brand"
                  size="sm"
                  icon="send"
                  disabled={!chosen}
                  loading={request.isPending}
                  onClick={() =>
                    run(
                      request
                        .mutateAsync({ targetEmail: chosen, message: message.trim() || null })
                        .then(() => setMessage('')),
                      'Request sent',
                    )
                  }
                >
                  Ask to see their calendar
                </Button>
              </div>
            </div>
          )}
        </Group>

        {waiting.length > 0 ? (
          <Group title="Waiting for an answer">
            <ul className="flex flex-col gap-1.5">
              {waiting.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2.5"
                >
                  <Person name={r.target.name} email={r.target.email} />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={withdraw.isPending}
                    onClick={() => run(withdraw.mutateAsync(r.id), 'Request withdrawn')}
                  >
                    Withdraw
                  </Button>
                </li>
              ))}
            </ul>
          </Group>
        ) : null}

        <Group title="Who can see yours">
          {granted.isPending ? (
            <Quiet>Loading…</Quiet>
          ) : seeMine.length === 0 ? (
            <Quiet>Nobody. When you share your calendar with a teammate, they appear here.</Quiet>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {seeMine.map((grant) => {
                const name = grant.viewer.name ?? grant.viewer.email;
                return (
                  <li
                    key={grant.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2.5"
                  >
                    <Person name={grant.viewer.name} email={grant.viewer.email} />
                    <div className="relative flex-none">
                      <select
                        aria-label={`What ${name} sees`}
                        value={grant.level}
                        disabled={update.isPending}
                        onChange={(e) =>
                          run(
                            update.mutateAsync({
                              id: grant.id,
                              level: e.target.value as CalendarAccessLevel,
                            }),
                            `Updated what ${name} sees`,
                          )
                        }
                        className="h-8 cursor-pointer appearance-none rounded-lg border border-line-2 bg-surface py-0 pr-7 pl-2.5 text-[12.5px] font-semibold text-ink-2 outline-none transition hover:bg-surface-2 focus:border-brand disabled:opacity-50"
                      >
                        <option value="FREE_BUSY">{LEVEL_LABEL.FREE_BUSY}</option>
                        <option value="VIEW">{LEVEL_LABEL.VIEW}</option>
                      </select>
                      <Icon
                        name="expand_more"
                        size={15}
                        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-ink-4"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Stop sharing with ${name}`}
                      title="Stop sharing"
                      disabled={revoke.isPending}
                      onClick={() =>
                        run(revoke.mutateAsync(grant.id), `${name} no longer sees your calendar`)
                      }
                      className="press grid size-8 flex-none place-items-center rounded-lg text-ink-4 transition hover:bg-surface-2 hover:text-danger disabled:opacity-50"
                    >
                      <Icon name="close" size={17} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Group>
      </div>
    </Modal>
  );
}

/**
 * On or off, with words: a bare checkbox beside a name did not say what it
 * switched, and the calendar it changes is hidden behind the dialog.
 */
function ShowToggle({
  on,
  colour,
  label,
  onClick,
  children,
}: {
  on: boolean;
  colour: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`press flex h-8 flex-none items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition ${
        on ? 'text-ink' : 'border-line-2 bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink'
      }`}
      style={
        on
          ? {
              borderColor: colour,
              background: `color-mix(in srgb, ${colour} 12%, var(--color-surface))`,
            }
          : {}
      }
    >
      <Icon
        name={on ? 'visibility' : 'visibility_off'}
        size={15}
        className="flex-none"
        style={on ? { color: colour } : {}}
      />
      {children}
    </button>
  );
}

/**
 * Every calendar shared with the user, as a row of switches over their own.
 *
 * The dialog is where access is asked for and given; this is where it is used,
 * without a dialog in the way of seeing what changed.
 */
export function TeammateChips({
  teammates,
  shown,
  onToggle,
}: {
  teammates: { email: string; name: string | null; colour: string }[];
  shown: string[];
  onToggle: (email: string) => void;
}) {
  if (teammates.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] font-semibold text-ink-3">Teammates' calendars</span>
      {teammates.map((teammate) => {
        const on = shown.includes(teammate.email);
        const name = teammate.name ?? teammate.email;
        return (
          <ShowToggle
            key={teammate.email}
            on={on}
            colour={teammate.colour}
            label={`${on ? 'Hide' : 'Show'} ${name}'s calendar`}
            onClick={() => onToggle(teammate.email)}
          >
            <span
              aria-hidden="true"
              className="size-2.5 flex-none rounded-full"
              style={{ background: teammate.colour }}
            />
            {name}
          </ShowToggle>
        );
      })}
    </div>
  );
}
