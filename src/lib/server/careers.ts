import "server-only";

import { getDatabase } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { createCareersService } from "@/services/careers-service";

import { getDocumentStorage, getMailer } from "./services";

export function getCareers() {
  return createCareersService({
    db: getDatabase(serverEnv.DATABASE_URL),
    storage: getDocumentStorage(),
    mailer: getMailer(),
    secret: process.env.AUTH_SECRET ?? "",
    publicUrl: process.env.CAREERS_PUBLIC_URL ?? serverEnv.APP_PUBLIC_URL,
  });
}
