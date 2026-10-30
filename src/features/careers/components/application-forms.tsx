"use client";

import { ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState, useTransition } from "react";

import { CAREERS_PRIVACY_URL, type CareerBoard } from "@/domain/careers";

import { requestCareerLinkAction, submitCareerAction } from "../actions";

const inputClass =
  "mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20 disabled:opacity-60";

function Trap() {
  return (
    <div className="hidden" aria-hidden="true">
      <label>
        Sito web
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

export function CareerEmailForm({ postingId = null, board }: { postingId?: string | null; board: CareerBoard }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sent)
    return (
      <div role="status" className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
        <Mail className="size-7" aria-hidden="true" />
        <h3 className="text-xl font-semibold">Controlla la tua email</h3>
        <p>Apri il link ricevuto per inserire i tuoi dati e allegare il curriculum. Il link è valido per 30 minuti.</p>
        <p className="text-sm">Se non lo trovi, controlla anche la cartella spam.</p>
      </div>
    );
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError(null);
        start(async () => {
          const result = await requestCareerLinkAction({
            postingId,
            board,
            email: data.get("email"),
            website: data.get("website") ?? "",
          });
          if (result.ok) setSent(true);
          else setError(result.error);
        });
      }}
    >
      <Trap />
      <p className="text-stone-600">
        Inizia dalla tua email. Ti invieremo un link personale per completare la candidatura e caricare il CV.
      </p>
      <label className="block text-sm font-medium">
        Indirizzo email
        <input
          className={inputClass}
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          placeholder="nome@esempio.it"
          required
          disabled={pending}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25271f] px-5 py-3.5 font-semibold text-white transition hover:bg-[#424634] disabled:opacity-60"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="size-4" aria-hidden="true" />
        )}
        Ricevi il link per candidarti
      </button>
      <p className="text-xs leading-relaxed text-stone-500">
        L&apos;indirizzo sarà utilizzato per inviare il link richiesto. Leggi la{" "}
        <a href={CAREERS_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline">
          nostra informativa privacy
        </a>
        .
      </p>
    </form>
  );
}

export function CareerApplicationForm({
  token,
  email,
  completed = false,
}: {
  token: string;
  email: string;
  completed?: boolean;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(completed);
  const [error, setError] = useState<string | null>(null);
  if (done)
    return (
      <div role="status" className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-950">
        <CheckCircle2 className="size-10" aria-hidden="true" />
        <h2 className="text-2xl font-semibold">Candidatura ricevuta</h2>
        <p>
          Grazie per il tuo interesse. Il nostro team valuterà il profilo e ti contatterà se in linea con le opportunità
          disponibili.
        </p>
      </div>
    );
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError(null);
        start(async () => {
          const result = await submitCareerAction(data);
          if (result.ok) setDone(true);
          else setError(result.error);
        });
      }}
    >
      <input type="hidden" name="token" value={token} />
      <Trap />
      <p className="rounded-xl bg-stone-100 p-4 text-sm text-stone-700">
        Email verificata: <strong>{email}</strong>
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Nome
          <input
            className={inputClass}
            name="firstName"
            autoComplete="given-name"
            maxLength={100}
            required
            disabled={pending}
          />
        </label>
        <label className="text-sm font-medium">
          Cognome
          <input
            className={inputClass}
            name="lastName"
            autoComplete="family-name"
            maxLength={100}
            required
            disabled={pending}
          />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Telefono
        <input
          className={inputClass}
          name="phone"
          type="tel"
          autoComplete="tel"
          minLength={5}
          maxLength={40}
          required
          disabled={pending}
        />
      </label>
      <label className="block text-sm font-medium">
        Curriculum vitae
        <input
          className={`${inputClass} file:mr-4 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm`}
          name="cv"
          type="file"
          accept=".pdf,application/pdf"
          required
          disabled={pending}
        />
        <span className="mt-2 block text-xs font-normal text-stone-500">Un file PDF, massimo 10 MB.</span>
      </label>
      <label className="block text-sm font-medium">
        Vuoi aggiungere un messaggio? <span className="font-normal text-stone-500">Facoltativo</span>
        <textarea className={inputClass} name="message" rows={4} maxLength={2000} disabled={pending} />
      </label>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-stone-700">
        <input
          className="mt-1 size-4 shrink-0 accent-[#6b613d]"
          name="consent"
          type="checkbox"
          required
          disabled={pending}
        />
        <span>
          Ho letto l&apos;
          <a className="underline" href={CAREERS_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            informativa privacy
          </a>{" "}
          e acconsento al trattamento dei miei dati per la gestione della candidatura e la selezione del personale.
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25271f] px-5 py-3.5 font-semibold text-white transition hover:bg-[#424634] disabled:opacity-60"
        disabled={pending}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {pending ? "Invio in corso…" : "Invia la candidatura"}
      </button>
    </form>
  );
}
