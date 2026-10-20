import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

interface FieldShellProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="font-hand text-[1.45rem] leading-none text-ink-soft">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm italic text-wax">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm italic text-ink-faded">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  boxed?: boolean;
  wrapperClassName?: string;
}

export function TextField({
  label,
  hint,
  error,
  boxed,
  wrapperClassName,
  className,
  id,
  ...rest
}: TextFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(boxed ? 'field-box' : 'field-input', className)}
        {...rest}
      />
    </FieldShell>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  wrapperClassName?: string;
}

export function TextArea({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  id,
  ...rest
}: TextAreaProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn('field-box min-h-28 resize-y leading-relaxed', className)}
        {...rest}
      />
    </FieldShell>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  wrapperClassName?: string;
}

export function Select({ label, wrapperClassName, className, id, children, ...rest }: SelectProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} className={wrapperClassName}>
      <select id={fieldId} className={cn('field-box h-11 py-0', className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

/** A hand-drawn checkbox: an inked square that gets a tick. */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn('group flex cursor-pointer items-start gap-3', disabled && 'opacity-60')}
    >
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden
        className="mt-1 grid size-5 shrink-0 place-items-center rounded-[3px] border-[1.5px] border-ink/60 bg-paper/60 transition group-hover:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-dashed peer-focus-visible:outline-quill peer-focus-visible:outline-offset-2"
      >
        <svg
          viewBox="0 0 20 20"
          className={cn(
            'size-4 text-quill transition-all',
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
        >
          <path
            d="M3 10.5 8 15 17 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="text-[1.05rem] leading-snug text-ink">{label}</span>
        {description && <span className="text-sm italic text-ink-faded">{description}</span>}
      </span>
    </label>
  );
}
