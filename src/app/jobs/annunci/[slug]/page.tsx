import { ArrowLeft, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { CareerEmailForm } from "@/features/careers/components/application-forms";
import { getCareers } from "@/lib/server/careers";

const load = cache((slug: string) => getCareers().get(slug));
export async function generateMetadata({ params }: PageProps<"/jobs/annunci/[slug]">): Promise<Metadata> {
  const posting = await load((await params).slug);
  return { title: posting?.content.title ?? "Offerta non disponibile" };
}

export default async function JobPage({ params }: PageProps<"/jobs/annunci/[slug]">) {
  const posting = await load((await params).slug);
  if (!posting) notFound();
  const { content } = posting;
  return (
    <div className="space-y-8">
      <Link
        href={`/jobs/${posting.board}`}
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tutte le opportunità
      </Link>
      <div className="grid items-start gap-9 lg:grid-cols-[1fr_360px]">
        <article className="space-y-8">
          <header className="space-y-4">
            <p className="text-sm font-medium tracking-wide text-[#8a7444] uppercase">{content.employer}</p>
            <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{content.title}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-stone-600">
              {content.location && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {content.location}
                </p>
              )}
              {content.contract && <p>{content.contract}</p>}
            </div>
          </header>
          <p className="text-lg leading-relaxed whitespace-pre-line text-stone-600">{content.summary}</p>
          {[
            ["Di cosa ti occuperai", content.duties],
            ["Cosa cerchiamo", content.requirements],
          ].map(
            ([title, text]) =>
              text && (
                <section key={title} className="space-y-3">
                  <h2 className="text-2xl font-semibold">{title}</h2>
                  <p className="leading-relaxed whitespace-pre-line text-stone-600">{text}</p>
                </section>
              ),
          )}
          {posting.expiresAt && (
            <p className="text-sm text-stone-500">
              Candidature entro il {posting.expiresAt.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}.
            </p>
          )}
        </article>
        <aside className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 lg:sticky lg:top-6">
          <h2 className="text-2xl font-semibold">Ti interessa questa posizione?</h2>
          <CareerEmailForm postingId={posting.id} board={posting.board} />
        </aside>
      </div>
    </div>
  );
}
