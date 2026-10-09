import { sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * Tipo comune per database e transazioni Drizzle, indipendente dal driver
 * (node-postgres in runtime, PGlite nei test). Una transazione è anch'essa
 * un `Database`: i repository funzionano identici dentro e fuori transazione.
 */
export type Database = PgDatabase<PgQueryResultHKT>;

/** Escapa i caratteri jolly di LIKE nell'input utente. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Confronto "contiene" insensibile a maiuscole e accenti. Il valore è sempre parametrizzato. */
export function containsText(column: SQLWrapper, value: string): SQL {
  return sql`unaccent(coalesce(${column}, '')) ILIKE unaccent(${`%${escapeLike(value)}%`})`;
}

/** Suddivide una ricerca libera in termini (max 6, per limitare la complessità della query). */
export function searchTerms(text: string | undefined): string[] {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6);
}

export function toCount(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

/** Lista di parametri per `IN (...)`, sempre parametrizzata. */
export function sqlList(values: readonly unknown[]): SQL {
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function pageBounds(request: { limit?: number; offset?: number }): { limit: number; offset: number } {
  return {
    limit: Math.min(Math.max(request.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE),
    offset: Math.max(request.offset ?? 0, 0),
  };
}
