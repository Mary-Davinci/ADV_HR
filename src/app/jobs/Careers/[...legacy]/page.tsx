import Link from "next/link";

export default function PreviousOffer() {
  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-semibold">Questa offerta non è più disponibile</h1>
      <p>Consulta le posizioni aperte oppure inviaci una candidatura spontanea.</p>
      <div className="flex flex-wrap gap-5">
        <Link className="underline" href="/jobs/Careers">
          Posizioni aperte
        </Link>
        <Link className="underline" href="/jobs/candidatura-spontanea?area=Careers">
          Candidatura spontanea
        </Link>
      </div>
    </section>
  );
}
