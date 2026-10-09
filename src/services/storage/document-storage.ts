import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageProvider } from "@/domain";

/**
 * Astrazione dello storage dei file. Il database conserva solo i metadati
 * (`documents.storage_key`). Nuovi provider (es. S3 compatibile, SharePoint)
 * si aggiungono implementando questa interfaccia, senza toccare servizi o UI.
 */
export interface DocumentStorage {
  readonly provider: StorageProvider;
  put(key: string, content: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

/** Le chiavi sono generate dal server: accetta solo segmenti sicuri (niente "..", niente path assoluti). */
const SAFE_KEY = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;

function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key)) throw new Error("Chiave di storage non valida");
}

/** Storage su filesystem locale, pensato per sviluppo e installazioni on-premise. */
export class LocalFileStorage implements DocumentStorage {
  readonly provider = "LOCAL" as const;
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  private resolve(key: string): string {
    assertSafeKey(key);
    const target = path.resolve(this.root, ...key.split("/"));
    if (!target.startsWith(this.root + path.sep)) throw new Error("Chiave di storage non valida");
    return target;
  }

  async put(key: string, content: Uint8Array): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, { flag: "wx" });
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

/** Storage in memoria per i test. */
export class MemoryStorage implements DocumentStorage {
  readonly provider = "MEMORY" as const;
  private readonly files = new Map<string, Uint8Array>();

  async put(key: string, content: Uint8Array): Promise<void> {
    assertSafeKey(key);
    this.files.set(key, content);
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.files.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}
