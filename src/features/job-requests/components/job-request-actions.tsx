"use client";

import { ArrowRight, Ban, Download, FileCheck2, Loader2, PlayCircle, Send, Undo2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { ButtonLink } from "@/components/common/button-link";
import { ConfirmButton } from "@/components/common/confirm-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { JobRequest } from "@/domain";
import { useActionMutation } from "@/hooks/use-action-mutation";

import {
  approveJobRequestAction,
  cancelJobRequestAction,
  reopenJobRequestAction,
  sendJobRequestAction,
  uploadSignedJobRequestAction,
} from "../server/actions";

interface Props {
  request: Pick<
    JobRequest,
    | "id"
    | "code"
    | "revision"
    | "status"
    | "reviewNote"
    | "selectionId"
    | "companyId"
    | "recipientEmail"
    | "sentAt"
    | "accessExpiresAt"
    | "submittedAt"
  >;
  signedDocument: { id: string; filename: string } | null;
  canManage: boolean;
  /** Email proposta per l'invio: referente del modulo o email dell'azienda. */
  suggestedEmail: string;
}

const formatDateTime = (date: Date) =>
  new Date(date).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function SendButton({ requestId, defaultEmail, resend }: { requestId: string; defaultEmail: string; resend: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const id = useId();
  const send = useActionMutation(sendJobRequestAction, {
    successMessage: "Modulo inviato all'azienda",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <>
      <Button variant={resend ? "outline" : "default"} onClick={() => setOpen(true)}>
        <Send aria-hidden="true" />
        {resend ? "Reinvia il link" : "Invia il modulo all'azienda"}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !send.isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle>{resend ? "Reinviare il link?" : "Inviare il modulo all'azienda?"}</DialogTitle>
            <DialogDescription>
              L&apos;azienda riceve una email con le istruzioni, il link personale per compilare il modulo online
              (valido 30 giorni) e il modulo vuoto in allegato.
              {resend && " Il link inviato in precedenza smetterà di funzionare."}
            </DialogDescription>
          </DialogHeader>
          <form
            id={id + "-form"}
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              send.mutate({ requestId, email });
            }}
          >
            <label htmlFor={id} className="text-sm font-medium">
              Email del referente dell&apos;azienda
            </label>
            <Input id={id} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={send.isPending}>
              Annulla
            </Button>
            <Button type="submit" form={id + "-form"} disabled={send.isPending || email.trim() === ""}>
              {send.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
              Invia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const CHECKS = [
  "La firma del legale rappresentante è presente",
  "Il timbro dell'azienda è presente",
  "Codice e revisione stampati sul modulo corrispondono a questa richiesta",
  "Tutte le pagine sono presenti e leggibili",
] as const;

function ReopenButton({ requestId, label, title }: { requestId: string; label: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const id = useId();
  const reopen = useActionMutation(reopenJobRequestAction, {
    successMessage: "Richiesta riaperta con una nuova revisione",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Undo2 aria-hidden="true" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !reopen.isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Si crea una nuova revisione: il PDF già generato o firmato non sarà più valido. Se il modulo era stato
              inviato all&apos;azienda, riceverà per email un nuovo link con la tua nota.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor={id} className="text-sm font-medium">
              Cosa va corretto
            </label>
            <Textarea
              id={id}
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={reopen.isPending}>
              Annulla
            </Button>
            <Button
              disabled={reopen.isPending || note.trim().length === 0}
              onClick={() => reopen.mutate({ requestId, note })}
            >
              {reopen.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
              Riapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SignedUpload({ requestId }: { requestId: string }) {
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
    formData.set("requestId", requestId);
    formData.set("file", file);
    setUploading(true);
    try {
      const result = await uploadSignedJobRequestAction(formData);
      if (result.ok) {
        toast.success("Modulo firmato caricato: ora va verificato");
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
        Modulo firmato
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
      <Button type="submit" size="sm" disabled={uploading}>
        {uploading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
        {uploading ? "Caricamento…" : "Carica firmato"}
      </Button>
    </form>
  );
}

function ApprovePanel({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false));
  const approve = useActionMutation(approveJobRequestAction, {
    successMessage: "Selezione aperta",
    onSuccess: () => router.refresh(),
  });
  const allChecked = checked.every(Boolean);
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Verifica del modulo firmato</legend>
        {CHECKS.map((label, index) => (
          <label key={label} className="flex items-start gap-2.5 text-sm leading-snug">
            <Checkbox
              className="mt-0.5"
              checked={checked[index]}
              onCheckedChange={(value) =>
                setChecked((current) => current.map((item, i) => (i === index ? value === true : item)))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <Button disabled={!allChecked || approve.isPending} onClick={() => approve.mutate({ requestId })}>
        {approve.isPending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <PlayCircle aria-hidden="true" />
        )}
        Approva e apri la selezione
      </Button>
    </div>
  );
}

/** Passo successivo della richiesta, in base allo stato. */
export function JobRequestActions({ request, signedDocument, canManage, suggestedEmail }: Props) {
  const router = useRouter();
  const cancel = useActionMutation(cancelJobRequestAction, {
    successMessage: "Richiesta annullata",
    onSuccess: () => router.refresh(),
  });
  const pdfHref = `/api/job-requests/${request.id}/pdf`;
  const cancelButton = canManage && ["DRAFT", "READY", "SIGNED"].includes(request.status) && (
    <ConfirmButton
      variant="ghost"
      size="default"
      title={`Annullare la richiesta ${request.code}?`}
      description="La richiesta resta nello storico ma non potrà più essere completata né aprire una selezione."
      confirmLabel="Annulla richiesta"
      onConfirm={() => cancel.mutateAsync({ requestId: request.id })}
    >
      <Ban aria-hidden="true" />
      Annulla richiesta
    </ConfirmButton>
  );

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base leading-snug font-medium">Prossimo passo</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        {request.reviewNote && ["DRAFT", "SENT"].includes(request.status) && (
          <Alert>
            <AlertTitle>Da correggere (revisione precedente)</AlertTitle>
            <AlertDescription>{request.reviewNote}</AlertDescription>
          </Alert>
        )}

        {request.status === "DRAFT" && (
          <>
            <p className="text-sm text-muted-foreground">
              Invia il modulo all&apos;azienda: lo compilerà online e la job description arriverà qui in automatico, con
              i candidati suggeriti. In alternativa puoi compilarlo tu e premere <strong>Segna come completa</strong>.
            </p>
            {canManage && <SendButton requestId={request.id} defaultEmail={suggestedEmail} resend={false} />}
          </>
        )}

        {request.status === "SENT" && (
          <>
            <p className="text-sm text-muted-foreground">
              In attesa che l&apos;azienda compili il modulo.
              {request.recipientEmail && request.sentAt && (
                <>
                  {" "}
                  Inviato a <strong>{request.recipientEmail}</strong> il {formatDateTime(request.sentAt)}
                  {request.accessExpiresAt && <>; link valido fino al {formatDateTime(request.accessExpiresAt)}</>}.
                </>
              )}
            </p>
            {canManage && (
              <SendButton requestId={request.id} defaultEmail={request.recipientEmail ?? suggestedEmail} resend />
            )}
          </>
        )}

        {request.status === "READY" && (
          <>
            {request.sentAt ? (
              <p className="text-sm text-muted-foreground">
                L&apos;azienda ha compilato il modulo
                {request.submittedAt && <> il {formatDateTime(request.submittedAt)}</>}: ha ricevuto il PDF da firmare e
                lo caricherà dal suo link. Se ve lo invia per email, potete caricarlo anche qui.
              </p>
            ) : (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Scarica il PDF compilato e fallo firmare e timbrare dal legale rappresentante.</li>
                <li>Carica qui la scansione del modulo firmato (PDF, JPG o PNG).</li>
              </ol>
            )}
            <ButtonLink href={pdfHref} variant="outline">
              <Download aria-hidden="true" />
              Scarica PDF da firmare
            </ButtonLink>
            {canManage && <SignedUpload requestId={request.id} />}
          </>
        )}

        {request.status === "SIGNED" && (
          <>
            <p className="text-sm text-muted-foreground">
              Confronta il firmato con il PDF generato: il codice{" "}
              <strong className="tabular-nums">{request.code}</strong> e la revisione{" "}
              <strong>{request.revision}</strong> devono comparire in alto su ogni pagina.
            </p>
            <div className="flex flex-wrap gap-2">
              {signedDocument && (
                <ButtonLink href={`/api/documents/${signedDocument.id}`} variant="outline">
                  <FileCheck2 aria-hidden="true" />
                  Apri il firmato
                </ButtonLink>
              )}
              <ButtonLink href={pdfHref} variant="outline">
                <Download aria-hidden="true" />
                PDF generato
              </ButtonLink>
            </div>
            {canManage && <ApprovePanel requestId={request.id} />}
          </>
        )}

        {request.status === "OPENED" && request.selectionId && (
          <ButtonLink href={`/companies/${request.companyId}/selections/${request.selectionId}`}>
            Vai alla selezione
            <ArrowRight aria-hidden="true" />
          </ButtonLink>
        )}

        {request.status === "CANCELLED" && (
          <p className="text-sm text-muted-foreground">Richiesta annullata: nessuna azione disponibile.</p>
        )}

        {canManage && (
          <div className="flex flex-wrap gap-2 border-t pt-4 empty:hidden">
            {request.status === "READY" && (
              <ReopenButton requestId={request.id} label="Riapri per modifiche" title="Riaprire la richiesta?" />
            )}
            {request.status === "SIGNED" && (
              <ReopenButton requestId={request.id} label="Da correggere" title="Il modulo firmato non è corretto" />
            )}
            {cancelButton}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
