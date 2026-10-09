"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { actionError, type ActionResult } from "@/lib/action-result";
import { getSafeCallbackUrl } from "@/lib/auth/callback-url";

import { loginSchema } from "../schemas/login-schema";

export async function loginAction(input: unknown, callbackUrl?: string): Promise<ActionResult<never>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return actionError("Controlla i dati inseriti.");

  try {
    // In caso di successo `signIn` lancia un redirect gestito da Next.js.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: getSafeCallbackUrl(callbackUrl),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return actionError(
        error.type === "CredentialsSignin"
          ? "Email o password non corrette."
          : "Accesso non riuscito. Riprova tra qualche istante.",
      );
    }
    throw error;
  }

  return actionError("Accesso non riuscito.");
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
