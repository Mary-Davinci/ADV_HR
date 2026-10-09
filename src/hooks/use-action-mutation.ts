"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

interface Options<TData> {
  successMessage?: string | ((data: TData) => string);
  errorTitle?: string;
  onSuccess?: (data: TData) => void;
}

/**
 * Esegue una server action che restituisce `ActionResult` con gestione
 * uniforme di stato (pending), successo ed errore (toast Sonner).
 * I messaggi d'errore arrivano già "puliti" dal server: mai stack trace.
 */
export function useActionMutation<TInput, TData>(
  action: (input: TInput) => Promise<ActionResult<TData>>,
  options: Options<TData> = {},
) {
  return useMutation({
    mutationFn: async (input: TInput) => {
      const result = await action(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      const message =
        typeof options.successMessage === "function" ? options.successMessage(data) : options.successMessage;
      if (message) toast.success(message);
      options.onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(options.errorTitle ?? "Operazione non riuscita", { description: error.message });
    },
  });
}
