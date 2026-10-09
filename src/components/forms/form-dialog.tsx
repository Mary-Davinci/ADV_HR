"use client";

import { Loader2 } from "lucide-react";
import { FormProvider, type FieldValues, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FormDialogProps<T extends FieldValues, TOutput extends FieldValues = T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  form: UseFormReturn<T, unknown, TOutput>;
  onSubmit: (values: TOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  size?: "md" | "lg" | "xl";
  children: React.ReactNode;
}

const SIZES = { md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-3xl" };

/**
 * Dialog con form: focus trap e chiusura da tastiera (Base UI),
 * contenuto scrollabile per form lunghi, pulsante primario disabilitato
 * durante il salvataggio.
 */
export function FormDialog<T extends FieldValues, TOutput extends FieldValues = T>({
  open,
  onOpenChange,
  title,
  description,
  form,
  onSubmit,
  isPending,
  submitLabel = "Salva",
  size = "md",
  children,
}: FormDialogProps<T, TOutput>) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent className={cn("max-h-[90svh] gap-0 p-0", SIZES[size])}>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex max-h-[90svh] flex-col">
            <DialogHeader className="border-b py-4 pr-12 pl-5">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <fieldset disabled={isPending} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {children}
            </fieldset>
            {/* Il DialogContent qui è p-0: annulla i margini negativi pensati per p-4. */}
            <DialogFooter className="m-0 px-5 py-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Annulla
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
                {isPending ? "Salvataggio…" : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
