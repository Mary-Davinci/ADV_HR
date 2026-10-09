import "server-only";

import { z } from "zod";

/**
 * Variabili d'ambiente SOLO server-side, validate all'avvio.
 * Non usare il prefisso NEXT_PUBLIC_ per nulla che sia sensibile.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /**
   * Sorgente dati dei repository. Oggi solo `postgres`.
   * `adv_core` è riservato al futuro bridge (non implementato).
   */
  DATA_SOURCE: z.enum(["postgres"]).default("postgres"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL è obbligatoria")
    .refine((value) => /^postgres(ql)?:\/\//.test(value), "DATABASE_URL deve essere una connection string PostgreSQL"),
  /** Directory dello storage locale dei documenti (sviluppo). */
  DOCUMENT_STORAGE_DIR: z.string().min(1).default("./storage/documents"),
  /** Mostra nel login il suggerimento per l'utente di sviluppo del seed. */
  AUTH_SHOW_DEV_HINT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Non includere i valori: solo i nomi delle variabili non valide.
  throw new Error(`Configurazione ambiente non valida:\n${z.prettifyError(parsed.error)}`);
}

export const serverEnv = parsed.data;
