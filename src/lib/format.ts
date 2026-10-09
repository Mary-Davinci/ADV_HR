import {
  differenceInYears,
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";
import { it } from "date-fns/locale";

import type { ISODate } from "@/domain";

/** Segnaposto uniforme per valori mancanti. */
export const EMPTY_VALUE = "—";

type DateInput = Date | ISODate | null | undefined;

function toDate(value: Exclude<DateInput, null | undefined>): Date {
  return value instanceof Date ? value : parseISO(value);
}

export function formatDate(value: DateInput): string {
  if (!value) return EMPTY_VALUE;
  return format(toDate(value), "d MMM yyyy", { locale: it });
}

export function formatNumericDate(value: DateInput): string {
  if (!value) return EMPTY_VALUE;
  return format(toDate(value), "dd/MM/yyyy");
}

export function formatLongDate(value: DateInput): string {
  if (!value) return EMPTY_VALUE;
  return format(toDate(value), "EEEE d MMMM yyyy", { locale: it });
}

export function formatTime(value: DateInput): string {
  if (!value) return EMPTY_VALUE;
  return format(toDate(value), "HH:mm");
}

export function formatDateTime(value: DateInput): string {
  if (!value) return EMPTY_VALUE;
  return format(toDate(value), "d MMM yyyy, HH:mm", { locale: it });
}

/** "Oggi", "Domani", "Ieri" oppure data breve: pensato per liste e agende. */
export function formatRelativeDay(value: DateInput): string {
  if (!value) return EMPTY_VALUE;
  const date = toDate(value);
  if (isToday(date)) return "Oggi";
  if (isTomorrow(date)) return "Domani";
  if (isYesterday(date)) return "Ieri";
  return format(date, "EEE d MMM", { locale: it });
}

export function formatSlot(value: DateInput): string {
  if (!value) return EMPTY_VALUE;
  return `${formatRelativeDay(value)}, ${formatTime(value)}`;
}

export function formatTimeAgo(value: DateInput): string {
  if (!value) return EMPTY_VALUE;
  return formatDistanceToNowStrict(toDate(value), { addSuffix: true, locale: it });
}

export function getAge(birthDate: ISODate | null, now: Date = new Date()): number | null {
  return birthDate ? differenceInYears(now, parseISO(birthDate)) : null;
}

export function formatMonths(months: number): string {
  if (months <= 0) return "meno di un mese";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years > 0 ? `${years} ${years === 1 ? "anno" : "anni"}` : null,
    rest > 0 ? `${rest} ${rest === 1 ? "mese" : "mesi"}` : null,
  ].filter(Boolean);
  return parts.join(" e ");
}

export function formatCurrency(value: number | null, currency = "EUR"): string {
  if (value === null) return EMPTY_VALUE;
  return new Intl.NumberFormat("it-IT", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return EMPTY_VALUE;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Valore per `<input type="datetime-local">` nel fuso locale. */
export function toDateTimeLocalValue(value: Date | null | undefined): string {
  return value ? format(value, "yyyy-MM-dd'T'HH:mm") : "";
}
