import * as React from "react";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm outline-none transition-shadow placeholder:text-[var(--muted)] focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-50";

export function Field({
  label,
  name,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      {error?.length ? <p className="mt-1 text-xs text-red-600">{error[0]}</p> : null}
    </div>
  );
}

export function TextField(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    name: string;
    error?: string[];
    hint?: string;
  },
) {
  const { label, name, error, hint, className, required, ...rest } = props;
  return (
    <Field label={label} name={name} error={error} hint={hint} required={required}>
      <input id={name} name={name} className={cn(inputCls, className)} required={required} {...rest} />
    </Field>
  );
}

export function TextareaField(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label: string;
    name: string;
    error?: string[];
    hint?: string;
  },
) {
  const { label, name, error, hint, className, required, ...rest } = props;
  return (
    <Field label={label} name={name} error={error} hint={hint} required={required}>
      <textarea
        id={name}
        name={name}
        rows={3}
        className={cn(inputCls, "h-auto py-2", className)}
        required={required}
        {...rest}
      />
    </Field>
  );
}

export function SelectField(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    name: string;
    error?: string[];
    hint?: string;
    options: { value: string; label: string }[];
    placeholder?: string;
  },
) {
  const { label, name, error, hint, className, required, options, placeholder, ...rest } = props;
  return (
    <Field label={label} name={name} error={error} hint={hint} required={required}>
      <select id={name} name={name} className={cn(inputCls, className)} required={required} {...rest}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string },
) {
  const { label, name, hint, className, ...rest } = props;
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" id={name} name={name} value="on" className={cn("mt-0.5", className)} {...rest} />
      <span>
        {label}
        {hint ? <span className="block text-xs text-[var(--muted)]">{hint}</span> : null}
      </span>
    </label>
  );
}
