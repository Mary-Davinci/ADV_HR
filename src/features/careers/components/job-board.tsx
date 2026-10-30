import { ArrowRight, BriefcaseBusiness, MapPin, Search } from "lucide-react";
import Link from "next/link";

import type { CareerBoard } from "@/domain/careers";
import { getCareers } from "@/lib/server/careers";

export async function JobBoard({ board, query }: { board: CareerBoard; query: string }) {
  const postings = await getCareers().list(board);
  const q = query.trim().slice(0, 100).toLocaleLowerCase("it");
  const results = q
    ? postings.filter((p) =>
        `${p.content.title} ${p.content.location} ${p.content.summary}`.toLocaleLowerCase("it").includes(q),
      )
    : postings;
  return (
    <div className="space-y-12">
      <section className="max-w-3xl space-y-5">
        <p className="text-xs font-semibold tracking-[.22em] text-[#8a7444] uppercase">
          {board === "aziende" ? "Le opportunità delle nostre aziende" : "Entra nel nostro team"}
        </p>
        <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
          {board === "aziende" ? "Il tuo prossimo passo professionale." : "Cresci con Accademia Da Vinci."}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-stone-600">
          {board === "aziende"
            ? "Esplora le posizioni aperte e raccontaci cosa sai fare. Mettiamo in contatto le tue competenze con le aziende del nostro territorio."
            : "Cerchiamo persone che credono nel valore della formazione e del lavoro. Scopri le posizioni aperte e inviaci la tua candidatura."}
        </p>
      </section>
      <section aria-label="Offerte disponibili" className="space-y-6">
        <form className="relative max-w-xl" role="search">
          <label htmlFor="job-search" className="sr-only">
            Cerca per ruolo o località
          </label>
          <Search className="absolute top-4 left-4 size-5 text-stone-400" aria-hidden="true" />
          <input
            id="job-search"
            name="q"
            defaultValue={query}
            maxLength={100}
            className="w-full rounded-xl border border-stone-300 bg-white py-3.5 pr-24 pl-12 text-sm outline-none focus:ring-2 focus:ring-amber-700/20"
            placeholder="Cerca un ruolo o una località"
          />
          <button className="absolute top-2 right-2 rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium hover:bg-stone-200">
            Cerca
          </button>
        </form>
        <p className="text-sm text-stone-500">
          {results.length} {results.length === 1 ? "opportunità disponibile" : "opportunità disponibili"}
        </p>
        {results.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {results.map(({ id, slug, content }) => (
              <article key={id} className="flex flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[#f1ede2] text-[#8a7444]">
                    <BriefcaseBusiness aria-hidden="true" className="size-5" />
                  </span>
                  {content.contract && (
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                      {content.contract}
                    </span>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-stone-500 uppercase">{content.employer}</p>
                  <h2 className="text-xl font-semibold">
                    <Link className="hover:underline" href={`/jobs/annunci/${slug}`}>
                      {content.title}
                    </Link>
                  </h2>
                </div>
                {content.location && (
                  <p className="flex items-center gap-2 text-sm text-stone-500">
                    <MapPin className="size-4" aria-hidden="true" />
                    {content.location}
                  </p>
                )}
                <p className="line-clamp-3 text-sm leading-relaxed text-stone-600">{content.summary}</p>
                <Link
                  className="mt-auto flex items-center gap-2 pt-2 text-sm font-semibold text-[#746135] hover:underline"
                  href={`/jobs/annunci/${slug}`}
                >
                  Scopri l&apos;offerta <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center">
            <h2 className="text-xl font-semibold">
              {q ? "Nessuna offerta trovata" : "Al momento non ci sono posizioni pubblicate"}
            </h2>
            <p className="mt-3 text-stone-600">
              {q
                ? "Prova con un altro ruolo o una località diversa."
                : "Puoi comunque inviarci il tuo curriculum con una candidatura spontanea."}
            </p>
          </div>
        )}
      </section>
      <section className="flex flex-col justify-between gap-6 rounded-2xl bg-[#eae5d6] p-7 sm:flex-row sm:items-center sm:p-9">
        <div className="max-w-xl space-y-2">
          <h2 className="text-2xl font-semibold">Non hai trovato l&apos;opportunità giusta?</h2>
          <p className="text-sm leading-relaxed text-stone-600">
            Inviaci una candidatura spontanea. Conosceremo il tuo profilo per le opportunità in linea con le tue
            competenze.
          </p>
        </div>
        <Link
          href={`/jobs/candidatura-spontanea?area=${board}`}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25271f] px-5 py-3.5 text-sm font-semibold text-white"
        >
          Candidati spontaneamente <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
