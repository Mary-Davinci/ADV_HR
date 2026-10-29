import "server-only";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { DomainRuleError } from "@/domain";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { ForbiddenError } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { EntityNotFoundError } from "@/repositories/types";
import { ConflictError, NotFoundError } from "@/services/context";

import { servicesFor, type Services } from "./services";

/** Codice SQLSTATE PostgreSQL, anche se l'errore è incapsulato da Drizzle (`cause`). */
function pgErrorCode(error: unknown): string | undefined {
  for (let current: unknown = error, depth = 0; current && depth < 3; depth++) {
    if (typeof current === "object" && "code" in current && typeof current.code === "string") return current.code;
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

/**
 * Descrizione sicura per i log: nome e codice, MAI il messaggio (Drizzle vi
 * include query e parametri, che possono contenere dati personali).
 */
export function describeError(error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error;
  const code = pgErrorCode(error);
  return code ? `${name} (SQLSTATE ${code})` : name;
}

/** Traduce gli errori noti in messaggi per l'utente; mai stack trace o dettagli SQL. */
function toUserMessage(error: unknown): string {
  if (error instanceof ForbiddenError) return error.message;
  if (error instanceof DomainRuleError || error instanceof ConflictError || error instanceof NotFoundError) {
    return error.message;
  }
  if (error instanceof EntityNotFoundError) return "L'elemento richiesto non esiste più.";
  // Violazioni di vincoli DB (es. unicità) senza esporre il dettaglio.
  if (pgErrorCode(error) === "23505") {
    return "Esiste già un elemento con questi dati.";
  }
  if (pgErrorCode(error) === "23514") return "I dati non rispettano i vincoli richiesti.";
  return "Operazione non riuscita. Riprova tra qualche istante.";
}

interface ActionOptions<TSchema extends z.ZodType> {
  schema: TSchema;
  /**
   * Percorsi da rivalidare dopo il successo. `"all"` rivalida l'intera area
   * applicativa (dati mostrati in molte viste: candidature, colloqui, dashboard).
   */
  revalidate?: "all" | string[] | ((input: z.output<TSchema>) => string[]);
}

/**
 * Esecuzione standard di una server action:
 * sessione → validazione Zod → servizio (che verifica i permessi) → revalidate.
 */
export async function runAction<TSchema extends z.ZodType, TResult>(
  rawInput: unknown,
  options: ActionOptions<TSchema>,
  handler: (input: z.output<TSchema>, services: Services) => Promise<TResult>,
): Promise<ActionResult<TResult>> {
  const user = await getSessionUser();
  if (!user) return actionError("Sessione scaduta: effettua di nuovo l'accesso.");

  const parsed = options.schema.safeParse(rawInput);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Dati non validi.");

  try {
    const result = await handler(parsed.data, servicesFor(user));
    if (options.revalidate === "all") {
      revalidatePath("/", "layout");
    } else {
      const paths =
        typeof options.revalidate === "function" ? options.revalidate(parsed.data) : (options.revalidate ?? []);
      for (const path of paths) revalidatePath(path);
    }
    return actionOk(result);
  } catch (error) {
    if (!(error instanceof ForbiddenError || error instanceof DomainRuleError || error instanceof ConflictError)) {
      // Log server-side senza input utente (può contenere dati personali).
      console.error("[action] errore", describeError(error));
    }
    return actionError(toUserMessage(error));
  }
}

/**
 * Server action PUBBLICA (senza sessione), es. il modulo compilato dall'azienda
 * tramite link personale: validazione Zod → handler (che verifica il token).
 * Stessa gestione degli errori di `runAction`, nessuna revalidate.
 */
export async function runPublicAction<TSchema extends z.ZodType, TResult>(
  rawInput: unknown,
  schema: TSchema,
  handler: (input: z.output<TSchema>) => Promise<TResult>,
): Promise<ActionResult<TResult>> {
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Dati non validi.");
  try {
    return actionOk(await handler(parsed.data));
  } catch (error) {
    if (!(error instanceof DomainRuleError || error instanceof NotFoundError)) {
      console.error("[public action] errore", describeError(error));
    }
    return actionError(toUserMessage(error));
  }
}
