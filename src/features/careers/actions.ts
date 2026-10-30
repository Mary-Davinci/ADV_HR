"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { DomainRuleError, MAX_DOCUMENT_SIZE_BYTES } from "@/domain";
import { actionError, actionOk } from "@/lib/action-result";
import { loginClientAddress } from "@/lib/auth/login-rate-limit";
import { requirePermission } from "@/lib/auth/session";
import { getCareers } from "@/lib/server/careers";
import { NotFoundError } from "@/services/context";

import { careerApplicationSchema, publicationSchema, requestCareerLinkSchema } from "./schemas";

function message(error: unknown) {
  if (error instanceof DomainRuleError || error instanceof NotFoundError) return error.message;
  console.error("[careers] operation failed:", error instanceof Error ? error.name : "UnknownError");
  return "Operazione non riuscita. Riprova tra qualche istante.";
}

export async function publishCareerAction(raw: unknown) {
  const user = await requirePermission("selection.manage");
  const parsed = publicationSchema.safeParse(raw);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Controlla i dati dell'annuncio.");
  try {
    const posting = await getCareers().publish(user, parsed.data);
    revalidatePath("/", "layout");
    return actionOk({ slug: posting.slug });
  } catch (error) {
    return actionError(message(error));
  }
}

export async function withdrawCareerAction(selectionId: string) {
  const user = await requirePermission("selection.manage");
  if (!publicationSchema.shape.selectionId.safeParse(selectionId).success) return actionError("Selezione non valida.");
  try {
    await getCareers().unpublish(user, selectionId);
    revalidatePath("/", "layout");
    return actionOk(null);
  } catch (error) {
    return actionError(message(error));
  }
}

export async function requestCareerLinkAction(raw: unknown) {
  const parsed = requestCareerLinkSchema.safeParse(raw);
  if (!parsed.success) return actionError("Inserisci un indirizzo email valido.");
  try {
    const ip = loginClientAddress(await headers(), Boolean(process.env.RAILWAY_PROJECT_ID));
    await getCareers().requestLink(parsed.data, ip);
    return actionOk(null);
  } catch (error) {
    return actionError(message(error));
  }
}

export async function submitCareerAction(form: FormData) {
  const parsed = careerApplicationSchema.safeParse({
    token: form.get("token"),
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    phone: form.get("phone"),
    message: form.get("message") ?? "",
    consent: form.get("consent") === "on",
    website: form.get("website") ?? "",
  });
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Controlla i dati.");
  const file = form.get("cv");
  if (
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > MAX_DOCUMENT_SIZE_BYTES ||
    file.type !== "application/pdf"
  )
    return actionError("Allega un curriculum PDF di massimo 10 MB.");
  try {
    const careers = getCareers();
    const proof = await careers.challenge(parsed.data.token);
    if (!proof.completed)
      await careers.submit(
        parsed.data,
        { name: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
        loginClientAddress(await headers(), Boolean(process.env.RAILWAY_PROJECT_ID)),
      );
    revalidatePath("/candidates");
    return actionOk(null);
  } catch (error) {
    return actionError(message(error));
  }
}
