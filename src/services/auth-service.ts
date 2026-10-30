import type { SessionUser } from "@/domain";
import { verifyPassword } from "@/lib/auth/password";
import type { LoginRateLimiter } from "@/lib/auth/login-rate-limit";
import type { UserRepository } from "@/repositories/types";

/**
 * Hash fittizio usato quando l'utente non esiste o non ha password, per
 * mantenere costante il tempo di risposta ed evitare di rivelare quali
 * email sono registrate.
 */
const TIMING_SAFE_DUMMY_HASH = [
  "scrypt",
  16384,
  8,
  1,
  Buffer.alloc(16).toString("base64"),
  Buffer.alloc(64).toString("base64"),
].join("$");

export function createAuthService(users: UserRepository, limiter: LoginRateLimiter) {
  return {
    async verifyCredentials(email: string, password: string, clientAddress = "unknown"): Promise<SessionUser | null> {
      if (!(await limiter.consume(email, clientAddress))) return null;
      const user = await users.findByEmailWithCredentials(email);
      const isValid = await verifyPassword(password, user?.passwordHash ?? TIMING_SAFE_DUMMY_HASH);

      if (!user || !user.passwordHash || !isValid || !user.active || user.roles.length === 0) return null;

      return { id: user.id, email: user.email, name: user.displayName, roles: user.roles };
    },
  };
}
