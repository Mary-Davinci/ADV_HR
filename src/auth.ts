import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getDatabase } from "@/db/client";
import { isRoleCode } from "@/domain";
import { loginSchema } from "@/features/auth/schemas/login-schema";
import { createLoginRateLimiter, loginClientAddress } from "@/lib/auth/login-rate-limit";
import { serverEnv } from "@/lib/env";
import { getDataStore } from "@/repositories";
import { createAuthService } from "@/services/auth-service";

let loginLimiter: ReturnType<typeof createLoginRateLimiter> | undefined;

/**
 * Configurazione Auth.js.
 *
 * Provider Credentials verificato contro gli utenti PERSISTENTI del database
 * ADV_HR (password hashate scrypt). Per introdurre SSO aziendale si aggiunge
 * un provider qui: pagine e DAL usano solo `auth()`.
 *
 * Il JWT contiene solo id e ruoli; il DAL ricarica comunque l'utente dal
 * database a ogni richiesta (utente disattivato = accesso revocato subito).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      id: "credentials",
      name: "Credenziali",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        loginLimiter ??= createLoginRateLimiter(getDatabase(serverEnv.DATABASE_URL), process.env.AUTH_SECRET ?? "");
        const user = await createAuthService(getDataStore().users, loginLimiter).verifyCredentials(
          parsed.data.email,
          parsed.data.password,
          loginClientAddress(request.headers, Boolean(process.env.RAILWAY_PROJECT_ID)),
        );
        return user ? { id: user.id, email: user.email, name: user.name, roles: user.roles } : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = user.roles;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      session.user.roles = (token.roles ?? []).filter(isRoleCode);
      return session;
    },
  },
});
