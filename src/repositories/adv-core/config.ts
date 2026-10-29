import { z } from "zod";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "advcore.local"]);

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL non impostata"),
  ADV_CORE_API_URL: z.url("ADV_CORE_API_URL non valida"),
  ADV_CORE_API_KEY: z.string().min(32, "ADV_CORE_API_KEY mancante o troppo corta"),
  ADV_CORE_SYNC_DOCUMENTS: z.enum(["true", "false"]).default("true"),
  ADV_CORE_SYNC_LOG_DIR: z.string().min(1).default("./storage/logs"),
  /**
   * Orari italiani delle esecuzioni pianificate, es. "13:20,18:20". Serve dove il
   * pianificatore ragiona in UTC (cron di Railway): il cron parte sia all'ora legale
   * sia alla solare e l'esecuzione fuori orario viene saltata. Vuoto = nessun controllo.
   */
  ADV_CORE_SYNC_TIMES: z
    .string()
    .trim()
    .regex(/^(([01]\d|2[0-3]):[0-5]\d)(,([01]\d|2[0-3]):[0-5]\d)*$/, "ADV_CORE_SYNC_TIMES: formato HH:MM,HH:MM")
    .optional(),
});

export interface AdvCoreSyncConfig {
  databaseUrl: string;
  apiUrl: string;
  apiKey: string;
  syncDocuments: boolean;
  logDir: string;
  scheduledTimes: string[];
}

/** Tolleranza sul ritardo di avvio del cron. */
const SCHEDULE_TOLERANCE_MINUTES = 15;

/** true se `now`, in ora italiana, cade entro la tolleranza dopo uno degli orari previsti. */
export function isScheduledTimeInItaly(now: Date, times: string[]): boolean {
  const [hours, minutes] = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(now)
    .split(":")
    .map(Number);
  const current = hours! * 60 + minutes!;
  return times.some((time) => {
    const [h, m] = time.split(":").map(Number);
    const delay = current - (h! * 60 + m!);
    return delay >= 0 && delay <= SCHEDULE_TOLERANCE_MINUTES;
  });
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
    logDir: parsed.data.ADV_CORE_SYNC_LOG_DIR,
    scheduledTimes: parsed.data.ADV_CORE_SYNC_TIMES?.split(",") ?? [],
  };
}
