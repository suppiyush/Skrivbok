/**
 * Labelled form field with inline error.
 *
 * The API returns `error.details[]` as `{ path, message }` per field, so the
 * frontend shows errors against the field that caused them rather than
 * flattening everything into one toast.
 */
import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
};

export function Field({ label, error, hint, className = '', ...rest }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={`h-11 rounded-[11px] border bg-surface px-3.5 text-[14.5px] text-ink outline-none
          transition placeholder:text-ink-5
          ${error ? 'border-danger' : 'border-line-2 focus:border-brand'}
          ${className}`}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-[12.5px] text-danger-ink">
          <span className="ms mt-px text-[15px]" aria-hidden="true">
            error
          </span>
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12.5px] leading-relaxed text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
