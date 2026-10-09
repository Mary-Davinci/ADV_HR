import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Inserisci l'indirizzo email")
    .pipe(z.email("Indirizzo email non valido"))
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Inserisci la password").max(200, "Password troppo lunga"),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
