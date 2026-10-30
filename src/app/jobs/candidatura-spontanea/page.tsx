import { CareerEmailForm } from "@/features/careers/components/application-forms";

export default async function Spontaneous({ searchParams }: PageProps<"/jobs/candidatura-spontanea">) {
  const { area } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-7">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-[.2em] text-[#8a7444] uppercase">Il primo passo</p>
        <h1 className="text-4xl font-semibold">Candidatura spontanea</h1>
        <p className="leading-relaxed text-stone-600">
          Raccontaci il tuo percorso. Valuteremo il tuo profilo per le opportunità disponibili{" "}
          {area === "Careers" || area === "docenti" ? "nel nostro team" : "nelle nostre aziende clienti"}.
        </p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-7">
        <CareerEmailForm board={area === "Careers" || area === "docenti" ? "Careers" : "aziende"} />
      </div>
    </div>
  );
}
