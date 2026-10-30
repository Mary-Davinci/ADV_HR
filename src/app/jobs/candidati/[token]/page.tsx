import type { Metadata } from "next";
import Link from "next/link";

import { CareerApplicationForm } from "@/features/careers/components/application-forms";
import { getCareers } from "@/lib/server/careers";
import { NotFoundError } from "@/services/context";

export const metadata: Metadata = {
  title: "Completa la candidatura",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function CandidateForm({ params }: PageProps<"/jobs/candidati/[token]">) {
  const { token } = await params;
  const proof = await getCareers()
    .challenge(token)
    .catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    });
  if (!proof)
    return (
      <div className="mx-auto max-w-xl space-y-5 rounded-2xl border border-stone-200 bg-white p-8">
        <h1 className="text-3xl font-semibold">Questo link non è più disponibile</h1>
        <p className="text-stone-600">
          Il link è scaduto oppure la posizione è stata chiusa. Torna alle opportunità per richiedere un nuovo link.
        </p>
        <Link href="/jobs/aziende" className="inline-block underline">
          Torna alle opportunità
        </Link>
      </div>
    );
  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <header className="space-y-3">
        <p className="text-xs font-semibold tracking-[.2em] text-[#8a7444] uppercase">La tua candidatura</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{proof.title}</h1>
        <p className="text-stone-600">Completa i tuoi dati e allega il curriculum.</p>
      </header>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <CareerApplicationForm token={token} email={proof.email} completed={proof.completed} />
      </div>
    </div>
  );
}
