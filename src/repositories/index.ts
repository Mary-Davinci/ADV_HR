import "server-only";

import { getDatabase } from "@/db/client";
import { serverEnv } from "@/lib/env";

import { createPostgresDataStore } from "./postgres";
import type { DataStore } from "./types";

export type * from "./types";

/**
 * Composition root del data layer: l'UNICO punto in cui si sceglie
 * quale implementazione dei repository usare.
 *
 *   DATA_SOURCE=postgres  → database ADV_HR (implementato)
 *   DATA_SOURCE=adv_core  → FUTURO: adapter read-only verso ADV CORE
 *                            (non implementato, vedi docs/ADV_CORE_BRIDGE.md)
 *
 * Pagine, componenti e servizi non devono cambiare quando cambia la sorgente.
 */

const globalForStore = globalThis as unknown as { __advHrDataStore?: DataStore };

function createDataStore(): DataStore {
  switch (serverEnv.DATA_SOURCE) {
    case "postgres":
      return createPostgresDataStore(getDatabase(serverEnv.DATABASE_URL));
  }
}

export function getDataStore(): DataStore {
  globalForStore.__advHrDataStore ??= createDataStore();
  return globalForStore.__advHrDataStore;
}
