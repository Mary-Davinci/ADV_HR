import { z } from "zod";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "advcore.local"]);

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL non impostata"),
  ADV_CORE_API_URL: z.url("ADV_CORE_API_URL non valida"),
  ADV_CORE_API_KEY: z.string().min(32, "ADV_CORE_API_KEY mancante o troppo corta"),
  ADV_CORE_SYNC_DOCUMENTS: z.enum(["true", "false"]).default("true"),
  DOCUMENT_STORAGE_DIR: z.string().min(1).default("./storage/documents"),
  ADV_CORE_SYNC_LOG_DIR: z.string().min(1).default("./storage/logs"),
});

export interface AdvCoreSyncConfig {
  databaseUrl: string;
  apiUrl: string;
  apiKey: string;
  syncDocuments: boolean;
  documentStorageDir: string;
  logDir: string;
}

/** Legge e valida la configurazione del worker. La chiave non viaggia mai in chiaro su HTTP. */
export function readAdvCoreSyncConfig(env: Record<string, string | undefined>): AdvCoreSyncConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Configurazione ADV Core non valida: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const url = new URL(parsed.data.ADV_CORE_API_URL);
  if (url.protocol !== "https:" && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("ADV_CORE_API_URL deve usare https:// (http è ammesso solo per ambienti locali).");
  }
  return {
    databaseUrl: parsed.data.DATABASE_URL,
    apiUrl: parsed.data.ADV_CORE_API_URL,
    apiKey: parsed.data.ADV_CORE_API_KEY,
    syncDocuments: parsed.data.ADV_CORE_SYNC_DOCUMENTS === "true",
    documentStorageDir: parsed.data.DOCUMENT_STORAGE_DIR,
    logDir: parsed.data.ADV_CORE_SYNC_LOG_DIR,
  };
}
