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
  // Storage dei documenti (cartella locale o bucket S3): vedi services/storage/storage-config.ts.
  /** Mostra nel login il suggerimento per l'utente di sviluppo del seed. */
  AUTH_SHOW_DEV_HINT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /**
   * Indirizzo pubblico di ADV_HR, usato nei link inviati alle aziende
   * (es. https://hr.davinciformazione.com). In sviluppo: http://localhost:3000.
   */
  APP_PUBLIC_URL: z
    .url("APP_PUBLIC_URL deve essere un URL completo")
    .default("http://localhost:3000")
    .transform((value) => value.replace(/\/+$/, "")),
  /**
   * Invio email. Senza SMTP_HOST le mail NON partono: vengono salvate come
   * file .eml in MAIL_OUTBOX_DIR (sviluppo e collaudo).
   */
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  /** true = TLS implicito (porta 465, es. smtps.aruba.it); false = STARTTLS (porta 587). */
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** Mittente, es. "Accademia Da Vinci – Selezione <selezione@davinciformazione.com>". */
  MAIL_FROM: z.string().trim().min(3).default("ADV_HR <noreply@localhost>"),
  /** Destinatario delle notifiche HR se l'autore della richiesta non ha un'email valida. */
  HR_NOTIFICATION_EMAIL: z.email().optional(),
  MAIL_OUTBOX_DIR: z.string().min(1).default("./storage/mail-outbox"),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Non includere i valori: solo i nomi delle variabili non valide.
  throw new Error(`Configurazione ambiente non valida:\n${z.prettifyError(parsed.error)}`);
}

export const serverEnv = parsed.data;
