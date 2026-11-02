"use server";

import { z } from "zod";

import { runAction } from "@/lib/server/action";
import { uuidSchema } from "@/lib/zod-helpers";

export async function getNotificationsAction() {
  return runAction({}, { schema: z.object({}) }, (_input, services) => services.notifications.overview());
}

/** Senza `ids` segna come lette tutte le notifiche dell'utente. */
export async function markNotificationsReadAction(input: unknown) {
  return runAction(
    input,
    { schema: z.object({ ids: z.array(uuidSchema).max(100).optional() }) },
    ({ ids }, services) => services.notifications.markRead(ids),
  );
}
