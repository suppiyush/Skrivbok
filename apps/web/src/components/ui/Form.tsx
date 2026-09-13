/**
 * Form controls.
 *
 * `Field` (text input) already exists and is unchanged. These are the rest of
 * the controls the create/edit dialogs need, sharing its label, hint and error
 * treatment so a form built from a mix of them looks like one form.
 *
 * Every control is uncontrolled by default and read with `FormData` on submit.
 * Controlled state per field would mean a re-render of the whole dialog on
 * every keystroke for no benefit — the values are only needed once.
 */
import {
  useId,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from './Icon';

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
      {children}
    </label>
  );
}

function Message({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string | undefined;
  hint?: ReactNode;
}) {
  if (error) {
    return (
      <p id={`${id}-error`} className="flex items-start gap-1.5 text-[12.5px] text-danger-ink">
        <Icon name="error" size={15} className="mt-px flex-none" />
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="text-[12.5px] leading-relaxed text-ink-3">
        {hint}
      </p>
    );
  }
  return null;
}

const CONTROL =
  'w-full rounded-[11px] border bg-surface px-3.5 text-[14.5px] text-ink outline-none transition placeholder:text-ink-5';

export function Textarea({
  label,
  error,
  hint,
  rows = 4,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${CONTROL} resize-y py-2.5 leading-relaxed ${
          error ? 'border-danger' : 'border-line-2 focus:border-brand'
        } ${className}`}
        {...rest}
      />
      <Message id={id} error={error} hint={hint} />
    </div>
  );
}

export function Select({
  label,
  error,
  hint,
  options,
  className = '',
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`${CONTROL} h-11 cursor-pointer appearance-none pr-10 ${
            error ? 'border-danger' : 'border-line-2 focus:border-brand'
          } ${className}`}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="expand_more"
          size={18}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-4"
        />
      </div>
      <Message id={id} error={error} hint={hint} />
    </div>
  );
}

/** Two controls side by side on wide screens, stacked on narrow ones. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** A checkbox with its label, sized to match the other controls' hit area. */
export function Checkbox({
  label,
  hint,
  name,
  defaultChecked,
}: {
  label: string;
  hint?: string;
  name: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 flex-none accent-[var(--color-brand)]"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[13.5px] font-semibold text-ink-2">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12.5px] text-ink-3">{hint}</span> : null}
      </label>
    </div>
  );
}

/**
 * Tags as chips.
 *
 * A comma or Enter turns what has been typed into a chip, pasting a
 * comma-separated list turns each part into one, and each chip has its own ×.
 * Backspace in an empty box takes the last chip back.
 *
 * Uncontrolled like the rest of this file: the chips live here, and a hidden
 * input carries them to `FormData` comma-joined — the same shape the plain
 * text field used to submit, so `toInput` did not have to change. Whatever is
 * still being typed is included, so a tag is not lost by pressing Save without
 * leaving the box first.
 */
export function TagInput({
  label,
  name,
  defaultValue = [],
  placeholder,
  hint,
  error,
  lowercase = false,
  max = 30,
}: {
  label: string;
  name: string;
  defaultValue?: string[];
  placeholder?: string;
  hint?: ReactNode;
  error?: string | undefined;
  /** Show tags the way the server will store them. */
  lowercase?: boolean;
  max?: number;
}) {
  const id = useId();
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [text, setText] = useState('');

  const normalise = (raw: string) => (lowercase ? raw.trim().toLowerCase() : raw.trim());

  function commit(raw: string) {
    const parts = raw.split(',').map(normalise).filter(Boolean);
    if (parts.length === 0) return;
    setTags((current) => {
      const next = [...current];
      for (const part of parts) if (!next.includes(part) && next.length < max) next.push(part);
      return next;
    });
  }

  const pending = normalise(text);
  const submitted = pending && !tags.includes(pending) ? [...tags, pending] : tags;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div
        className={`flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-[11px] border bg-surface px-2 py-1.5 transition ${
          error ? 'border-danger' : 'border-line-2 focus-within:border-brand'
        }`}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex h-7 items-center gap-1 rounded-md border border-line-2 bg-surface-2 pr-1 pl-2 text-[12.5px] font-semibold text-ink-2"
          >
            {tag}
            <button
              type="button"
              onClick={() => setTags((current) => current.filter((t) => t !== tag))}
              aria-label={`Remove tag ${tag}`}
              className="grid size-5 place-items-center rounded text-ink-4 transition hover:bg-surface-3 hover:text-ink"
            >
              <Icon name="close" size={13} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => {
            const value = e.target.value;
            const cut = value.lastIndexOf(',');
            if (cut === -1) {
              setText(value);
              return;
            }
            commit(value.slice(0, cut));
            setText(value.slice(cut + 1).trimStart());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Enter finishes a tag; it must not submit the dialog.
              e.preventDefault();
              commit(text);
              setText('');
            } else if (e.key === 'Backspace' && text === '' && tags.length > 0) {
              setTags((current) => current.slice(0, -1));
            }
          }}
          onBlur={() => {
            commit(text);
            setText('');
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="h-7 min-w-[120px] flex-1 bg-transparent px-1.5 text-[14.5px] text-ink outline-none placeholder:text-ink-5"
        />
      </div>
      <input type="hidden" name={name} value={submitted.join(',')} />
      <Message id={id} error={error} hint={hint} />
    </div>
  );
}
