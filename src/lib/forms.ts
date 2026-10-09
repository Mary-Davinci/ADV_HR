import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Resolver per i form collegati alle server action.
 *
 * Il client valida con lo schema Zod (errori immediati), ma invia i valori
 * GREZZI (`raw: true`): il server rivalida sempre con lo STESSO schema e
 * applica le trasformazioni. Un'unica fonte di regole, nessuna fiducia nel client.
 */
export function actionResolver<TSchema extends z.ZodType<unknown, FieldValues>>(
  schema: TSchema,
): Resolver<z.input<TSchema>> {
  return zodResolver(schema as never, undefined, { raw: true }) as unknown as Resolver<z.input<TSchema>>;
}
