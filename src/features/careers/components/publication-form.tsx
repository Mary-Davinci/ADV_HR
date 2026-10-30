"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { CareerBoard, PublicJobContent } from "@/domain/careers";

import { publishCareerAction, withdrawCareerAction } from "../actions";

type Publication = {
  board: CareerBoard;
  content: PublicJobContent;
  slug: string;
  publishedAt: Date | null;
  expiresAt: Date | null;
};
const fieldClass = "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm";

export function PublicationForm({
  selectionId,
  title,
  publication,
  canManage,
  open,
}: {
  selectionId: string;
  title: string;
  publication: Publication | null;
  canManage: boolean;
  open: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const content = publication?.content;
  const fields = [
    ["title", "Titolo dell’annuncio", content?.title ?? title, 200],
    ["employer", "Nome azienda da mostrare", content?.employer ?? "Azienda cliente", 160],
    ["location", "Sede di lavoro", content?.location ?? "", 160],
    ["contract", "Contratto e orario", content?.contract ?? "", 200],
  ] as const;

  return (
    <section className="space-y-5 rounded-xl border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Annuncio sul sito pubblico</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pubblica solo i testi destinati ai candidati. Note interne e dati della scheda azienda restano nel gestionale.
          Le candidature arrivano nella pipeline e nella sezione Candidati, con il CV allegato.
        </p>
      </div>
      {publication?.publishedAt ? (
        <p className="text-sm">
          {open ? "Annuncio pubblicato" : "Annuncio nascosto: la selezione non è aperta"}.{" "}
          <Link
            className="underline"
            href={`/jobs/annunci/${publication.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apri la pagina pubblica
          </Link>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Annuncio non pubblicato.</p>
      )}
      {!open && (
        <p role="status" className="text-sm text-amber-800">
          Per pubblicare, imposta la selezione su Aperta.
        </p>
      )}
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setError(null);
          setSaved(false);
          const values = Object.fromEntries(form.entries());
          start(async () => {
            const result = await publishCareerAction({ ...values, selectionId });
            if (!result.ok) setError(result.error);
            else setSaved(true);
          });
        }}
      >
        <fieldset disabled={!canManage || !open || pending} className="space-y-4 disabled:opacity-60">
          <label className="block text-sm font-medium">
            Sezione del sito
            <select className={fieldClass} name="board" defaultValue={publication?.board ?? "aziende"}>
              <option value="aziende">Offerte delle aziende</option>
              <option value="Careers">Lavora con noi · Accademia Da Vinci</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(([name, label, value, max]) => (
              <label key={name} className="text-sm font-medium">
                {label}
                <input
                  className={fieldClass}
                  name={name}
                  defaultValue={value}
                  maxLength={max}
                  required={name === "title" || name === "employer"}
                />
              </label>
            ))}
          </div>
          {(
            [
              ["summary", "Presentazione dell’opportunità"],
              ["duties", "Attività e responsabilità"],
              ["requirements", "Requisiti"],
            ] as const
          ).map(([name, label]) => (
            <label className="block text-sm font-medium" key={name}>
              {label}
              <textarea
                className={fieldClass}
                name={name}
                rows={5}
                maxLength={6000}
                minLength={name === "summary" ? 20 : undefined}
                required={name === "summary"}
                defaultValue={content?.[name] ?? ""}
              />
            </label>
          ))}
          <label className="block text-sm font-medium">
            Scadenza (facoltativa, fine giornata italiana)
            <input
              type="date"
              className={fieldClass}
              name="expiresOn"
              defaultValue={
                publication?.expiresAt
                  ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(publication.expiresAt)
                  : ""
              }
            />
          </label>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            disabled={pending}
          >
            {pending ? "Salvataggio…" : publication?.publishedAt ? "Aggiorna annuncio pubblico" : "Pubblica annuncio"}
          </button>
        </fieldset>
      </form>
      {canManage && publication?.publishedAt && (
        <button
          className="text-sm text-destructive underline disabled:opacity-50"
          disabled={pending}
          onClick={() => {
            setError(null);
            setSaved(false);
            start(async () => {
              const result = await withdrawCareerAction(selectionId);
              if (!result.ok) setError(result.error);
              else setSaved(true);
            });
          }}
        >
          Ritira dal sito
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-emerald-700">
          Modifiche salvate.
        </p>
      )}
    </section>
  );
}
