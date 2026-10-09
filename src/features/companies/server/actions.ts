"use server";

import { z } from "zod";

import { runAction } from "@/lib/server/action";
import { uuidSchema } from "@/lib/zod-helpers";

import { companySchema, jobDescriptionSchema, selectionSchema } from "../schemas";

export async function createCompanyAction(input: unknown) {
  return runAction(input, { schema: companySchema, revalidate: ["/companies"] }, (values, services) =>
    services.companies.create(values),
  );
}

export async function updateCompanyAction(input: unknown) {
  return runAction(
    input,
    { schema: z.object({ companyId: uuidSchema, values: companySchema }), revalidate: "all" },
    ({ companyId, values }, services) => services.companies.update(companyId, values),
  );
}

export async function createSelectionAction(input: unknown) {
  return runAction(input, { schema: selectionSchema, revalidate: "all" }, (values, services) =>
    services.selections.create(values),
  );
}

export async function updateSelectionAction(input: unknown) {
  return runAction(
    input,
    { schema: z.object({ selectionId: uuidSchema, values: selectionSchema }), revalidate: "all" },
    ({ selectionId, values }, services) => services.selections.update(selectionId, values),
  );
}

export async function saveJobDescriptionAction(input: unknown) {
  return runAction(
    input,
    { schema: z.object({ selectionId: uuidSchema, values: jobDescriptionSchema }), revalidate: "all" },
    ({ selectionId, values }, services) => services.selections.saveJobDescription(selectionId, values),
  );
}
