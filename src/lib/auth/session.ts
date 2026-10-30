import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import type { SessionUser } from "@/domain";
import { getDataStore } from "@/repositories";

import { can, type Permission } from "./permissions";
import { isDevelopmentAccount } from "./account-policy";

/**
 * Data Access Layer per la sessione. Il proxy fa solo un controllo
 * ottimistico: qui l'utente viene riletto dal DATABASE (una volta per
 * richiesta), così ruoli e disattivazioni hanno effetto immediato.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await getDataStore().users.getById(userId);
  if (!user || !user.active || user.roles.length === 0) return null;
  if (process.env.NODE_ENV === "production" && isDevelopmentAccount(user.email)) return null;

  return { id: user.id, email: user.email, name: user.displayName, roles: user.roles };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Per le pagine: senza permesso mostra la pagina "accesso negato". */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/forbidden");
  return user;
}
