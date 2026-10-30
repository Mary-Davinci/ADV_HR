import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CAREERS_PRIVACY_URL } from "@/domain/careers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Opportunità di lavoro · Accademia Da Vinci", template: "%s · Accademia Da Vinci" },
  referrer: "no-referrer",
  robots: { index: process.env.CAREERS_INDEXABLE === "true", follow: process.env.CAREERS_INDEXABLE === "true" },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-[#f7f5ef] text-[#25271f]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <Link
            href="/jobs/aziende"
            aria-label="Accademia Da Vinci · Opportunità di lavoro"
            className="flex items-center gap-3"
          >
            <Image
              src="/brand/adv-logo.jpg"
              alt=""
              width={48}
              height={48}
              priority
              className="size-12 object-contain"
            />
            <span className="leading-tight">
              <span className="block font-semibold tracking-wide">ACCADEMIA DA VINCI</span>
              <span className="text-xs text-stone-500">Persone, competenze, opportunità</span>
            </span>
          </Link>
          <nav aria-label="Portale lavoro" className="flex flex-wrap gap-5 text-sm">
            <Link className="hover:underline" href="/jobs/aziende">
              Offerte di lavoro
            </Link>
            <Link className="hover:underline" href="/jobs/Careers">
              Lavora con noi
            </Link>
            <a
              className="flex items-center gap-1 text-stone-500 hover:underline"
              href="https://www.davinciformazione.com/"
            >
              Il nostro sito <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-16">{children}</main>
      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-5 py-7 text-xs text-stone-500 sm:px-8">
          <p>Accademia Da Vinci · Il lavoro inizia dalle persone.</p>
          <a href={CAREERS_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline">
            Informativa privacy
          </a>
        </div>
      </footer>
    </div>
  );
}
