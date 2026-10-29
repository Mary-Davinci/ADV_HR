import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";

import { AppLogo } from "@/components/layout/app-logo";
import { LoginArtwork } from "@/features/auth/components/login-artwork";
import { LoginForm } from "@/features/auth/components/login-form";
import { serverEnv } from "@/lib/env";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Accesso" };

/** Carattere con grazie per il nome dell'app e il titolo, solo in questa pagina. */
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;

  return (
    <div className={cn(display.variable, "grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]")}>
      <aside className="relative hidden flex-col items-center justify-end overflow-hidden bg-[#17140f] p-10 lg:flex">
        <LoginArtwork />
        <p className="relative text-xs text-[#a39a89]">Uso interno riservato al personale autorizzato.</p>
      </aside>

      <main className="flex items-center justify-center bg-[#f7f3ea] px-6 py-12 text-[#1c1a17] dark:bg-background dark:text-foreground">
        <div className="w-full max-w-sm space-y-8">
          <AppLogo className="lg:hidden" />
          <div className="space-y-2">
            <h1 className="font-(family-name:--font-display) text-4xl leading-tight font-semibold">Accedi</h1>
            <p className="text-sm text-muted-foreground">Inserisci le tue credenziali aziendali per continuare.</p>
          </div>

          <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />

          <p className="text-center text-xs text-muted-foreground">
            Problemi di accesso? Contatta l&apos;amministratore.
          </p>

          {serverEnv.AUTH_SHOW_DEV_HINT && (
            <p className="rounded-lg border border-dashed bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Ambiente di sviluppo.</span> Utenti di prova (es.{" "}
              <code className="font-mono text-foreground">admin@adv-hr.local</code>) e password nel README.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
