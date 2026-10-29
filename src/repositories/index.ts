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

// A livello di modulo, non su globalThis: con l'hot reload il modulo si ricarica
// e i repository usano il codice aggiornato. Il pool di connessioni, quello sì,
// resta condiviso su globalThis (db/client.ts), quindi non si moltiplica.
let store: DataStore | undefined;

function createDataStore(): DataStore {
  switch (serverEnv.DATA_SOURCE) {
    case "postgres":
      return createPostgresDataStore(getDatabase(serverEnv.DATABASE_URL));
  }
}

export function getDataStore(): DataStore {
  store ??= createDataStore();
  return store;
}
