import type { z } from "zod";

import type { identitySchema, preferencesSchema, profileSchema } from "../schemas/profile-schemas";

/** Valori "grezzi" dei form (stringhe dei controlli) prima della validazione Zod. */
export type IdentityFormInput = z.input<typeof identitySchema>;
export type IdentityFormOutput = z.output<typeof identitySchema>;
export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileFormOutput = z.output<typeof profileSchema>;
export type PreferencesFormInput = z.input<typeof preferencesSchema>;
export type PreferencesFormOutput = z.output<typeof preferencesSchema>;
