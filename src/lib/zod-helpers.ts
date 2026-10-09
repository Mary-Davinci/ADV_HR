import { isValid, parseISO } from "date-fns";
import { z } from "zod";

/**
 * Helper Zod per form HTML: i controlli producono stringhe, il dominio
 * vuole `null` per i valori assenti e tipi corretti per numeri/booleani/date.
 */

export const requiredText = (max: number, message = "Campo obbligatorio") =>
  z.string().trim().min(1, message).max(max, `Massimo ${max} caratteri`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Massimo ${max} caratteri`)
    .transform((value) => value || null);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
  .refine((value) => isValid(parseISO(value)), "Data non valida");

export const optionalDate = z.union([z.literal("").transform(() => null), isoDate]);
export const requiredDate = isoDate;

export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.literal("").transform(() => null), z.enum(values)]);

export const optionalInt = (min: number, max: number) =>
  z.union([
    z.literal("").transform(() => null),
    z.coerce
      .number({ message: "Inserisci un numero" })
      .int("Inserisci un numero intero")
      .min(min, `Valore minimo ${min}`)
      .max(max, `Valore massimo ${max}`),
  ]);

export const optionalMoney = z.union([
  z.literal("").transform(() => null),
  z.coerce.number({ message: "Importo non valido" }).min(0, "Importo non valido").max(10_000_000, "Importo non valido"),
]);

/** Sì / No / Non indicato. */
export const triState = z.union([
  z.literal("").transform(() => null),
  z.enum(["true", "false"]).transform((v) => v === "true"),
]);

export const optionalEmail = z.union([
  z.literal("").transform(() => null),
  z.string().trim().toLowerCase().pipe(z.email("Email non valida")),
]);

export const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+\d\s().-]*$/, "Numero di telefono non valido")
  .transform((value) => value || null);

/** Codice fiscale italiano (persona fisica, anche con omocodia). */
export const FISCAL_CODE_PATTERN =
  /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPR-T][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

export const optionalFiscalCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => value === "" || FISCAL_CODE_PATTERN.test(value), "Codice fiscale non valido")
  .transform((value) => value || null);

export const optionalProvince = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => value === "" || /^[A-Z]{2}$/.test(value), "Sigla provincia di 2 lettere")
  .transform((value) => value || null);

export const uuidSchema = z.uuid("Identificativo non valido");

/** Converte un valore di dominio nel valore stringa atteso dal controllo form. */
export function toFormValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}
