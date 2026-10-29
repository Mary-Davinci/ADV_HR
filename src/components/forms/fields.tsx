"use client";

import { useId } from "react";
import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Campi form collegati a React Hook Form via `useFormContext`.
 * Label, descrizione ed errore sono sempre associati al controllo
 * (accessibilità: `htmlFor`, `aria-invalid`, `aria-describedby`).
 */

interface BaseProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  description?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

function useFieldIds() {
  const id = useId();
  return { inputId: `${id}-input`, descriptionId: `${id}-description`, errorId: `${id}-error` };
}

function FieldShell({
  label,
  required,
  description,
  error,
  ids,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  error?: string;
  ids: ReturnType<typeof useFieldIds>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={ids.inputId}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </FieldLabel>
      {children}
      {description && <FieldDescription id={ids.descriptionId}>{description}</FieldDescription>}
      {error && <FieldError id={ids.errorId}>{error}</FieldError>}
    </Field>
  );
}

function describedBy(ids: ReturnType<typeof useFieldIds>, description?: string, error?: string) {
  return [description ? ids.descriptionId : null, error ? ids.errorId : null].filter(Boolean).join(" ") || undefined;
}

export function TextField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  disabled,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
}: BaseProps<T> & {
  type?: "text" | "email" | "tel" | "url" | "date" | "time" | "datetime-local" | "number" | "password";
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  const { register, formState, getFieldState } = useFormContext<T>();
  const ids = useFieldIds();
  const error = getFieldState(name, formState).error?.message;
  return (
    <FieldShell
      label={label}
      required={required}
      description={description}
      error={error}
      ids={ids}
      className={className}
    >
      <Input
        id={ids.inputId}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        disabled={disabled || formState.isSubmitting}
        aria-invalid={Boolean(error)}
        aria-required={required}
        aria-describedby={describedBy(ids, description, error)}
        className="h-9"
        {...register(name)}
      />
    </FieldShell>
  );
}

export function TextareaField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  disabled,
  rows = 4,
  maxLength,
  placeholder,
}: BaseProps<T> & { rows?: number; maxLength?: number; placeholder?: string }) {
  const { register, formState, getFieldState } = useFormContext<T>();
  const ids = useFieldIds();
  const error = getFieldState(name, formState).error?.message;
  return (
    <FieldShell
      label={label}
      required={required}
      description={description}
      error={error}
      ids={ids}
      className={className}
    >
      <Textarea
        id={ids.inputId}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled || formState.isSubmitting}
        aria-invalid={Boolean(error)}
        aria-required={required}
        aria-describedby={describedBy(ids, description, error)}
        className="min-h-20"
        {...register(name)}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

/** Valore sentinella per "nessuna selezione" (Base UI Select non accetta stringa vuota come item). */
export const EMPTY_OPTION = "__none__";

export function SelectField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  disabled,
  options,
  placeholder = "Seleziona…",
  allowEmpty = !required,
  emptyLabel = "Non indicato",
}: BaseProps<T> & {
  options: SelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const { control } = useFormContext<T>();
  const ids = useFieldIds();
  const items = allowEmpty ? [{ value: EMPTY_OPTION, label: emptyLabel }, ...options] : options;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => (
        <FieldShell
          label={label}
          required={required}
          description={description}
          error={fieldState.error?.message}
          ids={ids}
          className={className}
        >
          <Select
            items={items}
            value={field.value ? String(field.value) : allowEmpty ? EMPTY_OPTION : null}
            onValueChange={(value) => field.onChange(value === EMPTY_OPTION || value === null ? "" : value)}
            disabled={disabled || formState.isSubmitting}
          >
            <SelectTrigger
              id={ids.inputId}
              ref={field.ref}
              onBlur={field.onBlur}
              aria-invalid={Boolean(fieldState.error)}
              aria-describedby={describedBy(ids, description, fieldState.error?.message)}
              className="h-9 w-full"
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {items.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>
      )}
    />
  );
}

/** Scelta sì/no/non indicato per booleani nullable. */
export function TriStateField<T extends FieldValues>(props: BaseProps<T>) {
  return (
    <SelectField
      {...props}
      options={[
        { value: "true", label: "Sì" },
        { value: "false", label: "No" },
      ]}
    />
  );
}

export function CheckboxField<T extends FieldValues>({
  name,
  label,
  description,
  className,
  disabled,
}: Omit<BaseProps<T>, "required">) {
  const { control } = useFormContext<T>();
  const ids = useFieldIds();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, formState }) => (
        <div className={cn("flex items-start gap-2.5", className)}>
          <Checkbox
            id={ids.inputId}
            checked={Boolean(field.value)}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            disabled={disabled || formState.isSubmitting}
            aria-describedby={description ? ids.descriptionId : undefined}
            className="mt-0.5"
          />
          <div className="grid gap-0.5">
            <label htmlFor={ids.inputId} className="text-sm leading-snug font-medium">
              {label}
            </label>
            {description && (
              <p id={ids.descriptionId} className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
      )}
    />
  );
}

/** Scelta multipla: il valore del campo è l'array dei valori spuntati. */
export function CheckboxGroupField<T extends FieldValues>({
  name,
  label,
  description,
  className,
  disabled,
  options,
}: Omit<BaseProps<T>, "required"> & { options: Array<{ value: string; label: string }> }) {
  const { control } = useFormContext<T>();
  const ids = useFieldIds();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => {
        const selected: string[] = Array.isArray(field.value) ? field.value : [];
        const error = fieldState.error?.message;
        return (
          <fieldset
            className={cn("grid gap-2", className)}
            aria-describedby={describedBy(ids, description, error)}
            aria-invalid={Boolean(error)}
          >
            <legend className="mb-1 text-sm font-medium">{label}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((option) => {
                const optionId = `${ids.inputId}-${option.value}`;
                return (
                  <div key={option.value} className="flex items-center gap-2.5">
                    <Checkbox
                      id={optionId}
                      checked={selected.includes(option.value)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked === true
                            ? [...selected, option.value]
                            : selected.filter((value) => value !== option.value),
                        )
                      }
                      disabled={disabled || formState.isSubmitting}
                    />
                    <label htmlFor={optionId} className="text-sm leading-snug">
                      {option.label}
                    </label>
                  </div>
                );
              })}
            </div>
            {description && (
              <p id={ids.descriptionId} className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
            {error && (
              <p id={ids.errorId} className="text-sm text-destructive">
                {error}
              </p>
            )}
          </fieldset>
        );
      }}
    />
  );
}

/** Griglia responsive per affiancare campi brevi. */
export function FieldRow({ children, columns = 2 }: { children: React.ReactNode; columns?: 2 | 3 }) {
  return <div className={cn("grid gap-4", columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>{children}</div>;
}
