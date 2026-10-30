import { z } from "zod";

import { CAREER_BOARDS } from "@/domain/careers";

const short = (max: number) => z.string().trim().max(max);
export const publicationSchema = z.object({
  selectionId: z.uuid(),
  board: z.enum(CAREER_BOARDS),
  title: short(200).min(3),
  employer: short(160).min(2),
  location: short(160),
  summary: short(6000).min(20),
  duties: short(6000),
  requirements: short(6000),
  contract: short(200),
  expiresOn: z.union([z.iso.date(), z.literal("")]),
});
export const requestCareerLinkSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email().max(254))
    .transform((value) => value.toLowerCase()),
  postingId: z.uuid().nullable(),
  board: z.enum(CAREER_BOARDS),
  website: short(200).default(""),
});
export const careerApplicationSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  firstName: short(100).min(1, "Inserisci il nome"),
  lastName: short(100).min(1, "Inserisci il cognome"),
  phone: short(40).min(5, "Inserisci un recapito telefonico"),
  message: short(2000),
  consent: z.literal(true, { error: "Leggi l'informativa e presta il consenso per inviare la candidatura." }),
  website: short(200).default(""),
});
