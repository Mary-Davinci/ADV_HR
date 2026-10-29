"use client";

import { CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { ButtonLink } from "@/components/common/button-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { PublicJobRequestView } from "@/services/job-requests/public-job-request-service";

import {
  savePublicJobRequestAction,
  submitPublicJobRequestAction,
  uploadPublicSignedAction,
} from "../server/public-actions";
import { JobRequestFormBase } from "./job-request-form";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

function SignedUpload({ token }: { token: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const id = useId();

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Seleziona il modulo firmato");
      return;
    }
    const formData = new FormData();
    formData.set("token", token);
    formData.set("file", file);
    setUploading(true);
    try {
      const result = await uploadPublicSignedAction(formData);
      if (result.ok) {
        toast.success("Modulo firmato ricevuto. Grazie!");
        router.refresh();
      } else {
        toast.error("Caricamento non riuscito", { description: result.error });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={upload}
      className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center"
    >
      <label htmlFor={id} className="sr-only">
        Modulo firmato (PDF, JPG o PNG)
      </label>
      <input
        id={id}
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
        required
        disabled={uploading}
        className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-2.5 file:py-1 file:text-sm file:font-medium"
      />
      <Button type="submit" disabled={uploading}>
        {uploading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
        {uploading ? "Caricamento…" : "Carica il modulo firmato"}
      </Button>
    </form>
  );
}

/** Pagina dell'azienda: compila → scarica e firma → carica il firmato. */
export function PublicJobRequest({ token, view }: { token: string; view: PublicJobRequestView }) {
  const router = useRouter();
  const editable = view.status === "SENT";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Modulo Job Description</h1>
        <p className="text-sm text-muted-foreground">
          {view.companyName} · richiesta {view.code} (revisione {view.revision}) · link valido fino al{" "}
          {formatDate(view.expiresAt)}
        </p>
      </header>

      {view.correctionNote && (
        <Alert>
          <AlertTitle>Correzioni richieste da Accademia Da Vinci</AlertTitle>
          <AlertDescription>{view.correctionNote}</AlertDescription>
        </Alert>
      )}

      {view.status === "SENT" && (
        <Card>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">Come funziona</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Compila il modulo: puoi salvare la bozza e riprendere più tardi con lo stesso link.</li>
              <li>
                Premi <strong>Invia il modulo</strong>: controlliamo che tutti i dati siano completi e corretti.
              </li>
              <li>Scarica il PDF compilato, fallo firmare e timbrare dal legale rappresentante.</li>
              <li>Carica la scansione firmata da questa stessa pagina.</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {view.status === "READY" && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-medium">Modulo ricevuto: manca solo la firma</h2>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Scarica il PDF compilato (codice <strong>{view.code}</strong>, revisione {view.revision}), fallo firmare e
              timbrare dal legale rappresentante e carica qui la scansione. Ti abbiamo inviato il PDF anche per email.
            </p>
            <ButtonLink href={`/modulo/${token}/pdf`} variant="outline">
              <Download aria-hidden="true" />
              Scarica il PDF da firmare
            </ButtonLink>
            <SignedUpload token={token} />
          </CardContent>
        </Card>
      )}

      {view.status === "SIGNED" && (
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Grazie, abbiamo ricevuto il modulo firmato</AlertTitle>
          <AlertDescription>
            Il nostro ufficio selezione lo verificherà e vi contatterà per i prossimi passi. Non serve fare altro.
          </AlertDescription>
        </Alert>
      )}

      <JobRequestFormBase
        key={`${view.revision}-${view.status}`}
        initialValues={view.form}
        editable={editable}
        save={(values) => savePublicJobRequestAction({ token, values })}
        submit={(values) => submitPublicJobRequestAction({ token, values })}
        texts={{ submitLabel: "Invia il modulo", submitSuccess: "Modulo inviato: ora scarica il PDF da firmare" }}
        onSubmitted={() => {
          router.refresh();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
