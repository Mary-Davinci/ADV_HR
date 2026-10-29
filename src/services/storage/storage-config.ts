import { z } from "zod";

import { LocalFileStorage, type DocumentStorage } from "./document-storage";
import { S3Storage, type S3StorageConfig } from "./s3-storage";

/**
 * Configurazione dello storage dei documenti, condivisa da app, sincronizzazione
 * ADV Core e indicizzazione CV (che devono leggere e scrivere gli stessi file).
 *
 * - `local` (default): cartella DOCUMENT_STORAGE_DIR, sviluppo e PC ufficio;
 * - `s3`: bucket S3 compatibile, produzione su Railway (app e cron sono servizi
 *   separati e non condividono un disco).
 */
const schema = z
  .object({
    DOCUMENT_STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    DOCUMENT_STORAGE_DIR: z.string().min(1).default("./storage/documents"),
    S3_BUCKET: z.string().trim().optional(),
    S3_ENDPOINT: z.url("S3_ENDPOINT deve essere un URL completo").optional(),
    S3_REGION: z.string().trim().min(1).default("auto"),
    S3_ACCESS_KEY_ID: z.string().trim().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    S3_PREFIX: z
      .string()
      .regex(/^([a-z0-9-]+\/)*$/, "S3_PREFIX: solo minuscole, cifre e trattini, terminato da /")
      .default("documents/"),
  })
  .superRefine((env, ctx) => {
    if (env.DOCUMENT_STORAGE_PROVIDER !== "s3") return;
    for (const name of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!env[name])
        ctx.addIssue({ code: "custom", path: [name], message: `${name} è obbligatoria con lo storage s3` });
    }
  });

export type StorageConfig = { provider: "local"; dir: string } | ({ provider: "s3" } & S3StorageConfig);

/** Valida la configurazione. Gli errori riportano solo i nomi delle variabili, mai i valori. */
export function readStorageConfig(env: Record<string, string | undefined>): StorageConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Configurazione storage non valida: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const data = parsed.data;
  if (data.DOCUMENT_STORAGE_PROVIDER === "local") return { provider: "local", dir: data.DOCUMENT_STORAGE_DIR };
  return {
    provider: "s3",
    bucket: data.S3_BUCKET!,
    endpoint: data.S3_ENDPOINT,
    region: data.S3_REGION,
    accessKeyId: data.S3_ACCESS_KEY_ID!,
    secretAccessKey: data.S3_SECRET_ACCESS_KEY!,
    forcePathStyle: data.S3_FORCE_PATH_STYLE,
    prefix: data.S3_PREFIX,
  };
}

export function createDocumentStorage(config: StorageConfig): DocumentStorage {
  return config.provider === "local" ? new LocalFileStorage(config.dir) : new S3Storage(config);
}
