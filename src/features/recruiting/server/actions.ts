"use server";

import { z } from "zod";

import { runAction } from "@/lib/server/action";
import { uuidSchema } from "@/lib/zod-helpers";

import {
  applicationInput,
  changeStageSchema,
  createApplicationSchema,
  createApplicationsSchema,
  evaluationSchema,
  feedbackSchema,
  interviewInput,
  interviewSchema,
} from "../schemas";

/** Candidature e colloqui compaiono in molte viste (scheda, selezione, agenda, dashboard). */
const revalidateApp = "all" as const;

export async function createApplicationAction(input: unknown) {
  return runAction(input, { schema: createApplicationSchema, revalidate: revalidateApp }, (values, services) =>
    services.applications.create(values),
  );
}

export async function createApplicationsAction(input: unknown) {
  return runAction(input, { schema: createApplicationsSchema, revalidate: revalidateApp }, (values, services) =>
    services.applications.createMany({ ...values, source: "ADV_HR" }),
  );
}

export async function changeStageAction(input: unknown) {
  return runAction(
    input,
    { schema: changeStageSchema, revalidate: revalidateApp },
    ({ applicationId, ...values }, services) => services.applications.changeStage(applicationId, values),
  );
}

export async function evaluateApplicationAction(input: unknown) {
  return runAction(
    input,
    { schema: applicationInput(evaluationSchema), revalidate: revalidateApp },
    ({ applicationId, values }, services) => services.applications.evaluate(applicationId, values),
  );
}

export async function addFeedbackAction(input: unknown) {
  return runAction(
    input,
    { schema: applicationInput(feedbackSchema), revalidate: revalidateApp },
    ({ applicationId, values }, services) => services.applications.addFeedback(applicationId, values),
  );
}

export async function assignRecruiterAction(input: unknown) {
  return runAction(
    input,
    {
      schema: z.object({ applicationId: uuidSchema, recruiterId: uuidSchema.nullable() }),
      revalidate: revalidateApp,
    },
    ({ applicationId, recruiterId }, services) => services.applications.assignRecruiter(applicationId, recruiterId),
  );
}

export async function scheduleInterviewAction(input: unknown) {
  return runAction(
    input,
    { schema: applicationInput(interviewSchema), revalidate: revalidateApp },
    ({ applicationId, values }, services) => services.interviews.schedule(applicationId, values),
  );
}

export async function updateInterviewAction(input: unknown) {
  return runAction(
    input,
    { schema: interviewInput(interviewSchema), revalidate: revalidateApp },
    ({ interviewId, values }, services) => services.interviews.update(interviewId, values),
  );
}

export async function removeApplicationAction(input: unknown) {
  return runAction(
    input,
    { schema: z.object({ applicationId: uuidSchema }), revalidate: revalidateApp },
    ({ applicationId }, services) => services.applications.remove(applicationId),
  );
}
