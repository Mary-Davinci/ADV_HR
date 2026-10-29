import Image from "next/image";

/** Area pubblica per le aziende: nessun menu interno, solo il marchio. */
export default function PublicFormLayout({ children }: LayoutProps<"/modulo">) {
  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Image src="/brand/adv-logo.jpg" alt="" width={36} height={36} className="size-9 object-contain" priority />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Accademia Da Vinci</p>
            <p className="text-xs text-muted-foreground">Ente di Formazione Nazionale · Selezione del personale</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
