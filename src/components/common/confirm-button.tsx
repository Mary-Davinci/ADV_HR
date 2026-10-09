"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmButtonProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<unknown>;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  "aria-label"?: string;
  disabled?: boolean;
}

/** Pulsante per azioni distruttive: chiede sempre conferma esplicita. */
export function ConfirmButton({
  title,
  description,
  confirmLabel = "Conferma",
  onConfirm,
  children,
  variant = "ghost",
  size = "sm",
  disabled,
  ...rest
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger
        render={<Button variant={variant} size={size} disabled={disabled} aria-label={rest["aria-label"]} />}
      >
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annulla</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                // L'errore è già notificato dal chiamante (toast).
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
