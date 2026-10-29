"use client";

import { FilePlus2, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useActionMutation } from "@/hooks/use-action-mutation";

import { createAndSendJobRequestAction, createJobRequestAction } from "../server/actions";

/** V verde animata (vedi .adv-success-* in globals.css). */
function SuccessCheck() {
  return (
    <svg viewBox="0 0 52 52" aria-hidden="true" className="adv-success-pop size-20">
      <circle cx="26" cy="26" r="24" className="fill-emerald-500/15 stroke-emerald-500" strokeWidth="2.5" />
      <path
        d="M15 27.5 L22.5 35 L37.5 19"
        fill="none"
        className="adv-success-check stroke-emerald-600"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Nuova richiesta di personale: chiede solo l'email del referente e invia
 * subito il modulo all'azienda, restando sulla scheda azienda. Per i dati
 * dettati al telefono resta la compilazione interna.
 */
export function CreateJobRequestButton({ companyId, defaultEmail }: { companyId: string; defaultEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [sent, setSent] = useState<{ code: string; email: string } | null>(null);
  const id = useId();

  const send = useActionMutation(createAndSendJobRequestAction, {
    errorTitle: "Job request non inviata",
    onSuccess: ({ code }) => {
      setSent({ code, email });
      router.refresh();
    },
  });
  const internal = useActionMutation(createJobRequestAction, {
    onSuccess: ({ id: requestId }) => router.push(`/companies/${companyId}/requests/${requestId}`),
  });
  const pending = send.isPending || internal.isPending;

  function openDialog() {
    setEmail(defaultEmail);
    setSent(null);
    setOpen(true);
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        <Send aria-hidden="true" />
        Nuova richiesta di personale
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center" role="status" aria-live="polite">
              <SuccessCheck />
              <DialogTitle className="text-lg">Job request inviata all&apos;azienda</DialogTitle>
              <DialogDescription>
                Abbiamo inviato a <strong className="text-foreground">{sent.email}</strong> il link per compilare il
                modulo online (richiesta {sent.code}). Quando l&apos;azienda lo invia, la job description arriva qui in
                automatico e ricevi una notifica.
              </DialogDescription>
              <Button className="mt-2" onClick={() => setOpen(false)}>
                Fatto
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle>Nuova richiesta di personale</DialogTitle>
                <DialogDescription>
                  L&apos;azienda riceve una email con le istruzioni, il link personale per compilare il modulo online
                  (valido 30 giorni) e il modulo vuoto in allegato.
                </DialogDescription>
              </DialogHeader>
              <form
                id={`${id}-form`}
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  send.mutate({ companyId, email });
                }}
              >
                <label htmlFor={id} className="text-sm font-medium">
                  Email del referente dell&apos;azienda
                </label>
                <Input
                  id={id}
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome@azienda.it"
                />
              </form>
              <DialogFooter className="sm:justify-between">
                <Button type="button" variant="ghost" disabled={pending} onClick={() => internal.mutate({ companyId })}>
                  {internal.isPending ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <FilePlus2 aria-hidden="true" />
                  )}
                  Preferisci compilarlo tu?
                </Button>
                <Button type="submit" form={`${id}-form`} disabled={pending || email.trim() === ""}>
                  {send.isPending ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Send aria-hidden="true" />
                  )}
                  Invia all&apos;azienda
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
