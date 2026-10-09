import { CalendarClock, FileSearch, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { AppLogo } from "@/components/layout/app-logo";
import { LoginForm } from "@/features/auth/components/login-form";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Accesso" };

const HIGHLIGHTS = [
  { icon: FileSearch, text: "Ricerca e selezione dei candidati in un unico flusso" },
  { icon: CalendarClock, text: "Agenda dei colloqui sempre aggiornata" },
  { icon: ShieldCheck, text: "Dati personali trattati in modo riservato" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r bg-[#f4f2ee] p-10 text-neutral-900 lg:flex">
        {/* Ancorato a sinistra: resta visibile solo il rilievo vitruviano. */}
        <Image
          src="/brand/login-background.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-left"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-[#f4f2ee] via-[#f4f2ee]/70 to-[#f4f2ee]/20"
        />
        <AppLogo className="relative [&_.text-muted-foreground]:text-neutral-600" />
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            La piattaforma HR di Accademia Da Vinci
          </h2>
          <ul className="space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-neutral-700">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-neutral-300/70 bg-white/80">
                  <Icon aria-hidden="true" className="size-4 text-[#8a6a1f]" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-neutral-600">Uso interno riservato al personale autorizzato.</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <AppLogo className="lg:hidden" />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Accedi</h1>
            <p className="text-sm text-muted-foreground">Inserisci le tue credenziali per continuare.</p>
          </div>

          <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />

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
