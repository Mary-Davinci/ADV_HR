import { S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

import { backupDocuments } from "./document-backup";
import { readStorageConfig } from "./storage-config";

async function main() {
  const source = readStorageConfig(process.env);
  if (source.provider !== "s3") throw new Error("S3 source is required");
  const result = z
    .object({
      BACKUP_S3_BUCKET: z.string().min(1),
      BACKUP_S3_ENDPOINT: z.url().refine((url) => url.startsWith("https://")),
      BACKUP_S3_REGION: z.string().default("auto"),
      BACKUP_S3_ACCESS_KEY_ID: z.string().min(1),
      BACKUP_S3_SECRET_ACCESS_KEY: z.string().min(1),
    })
    .safeParse(process.env);
  if (!result.success) throw new Error("Backup configuration is missing or invalid");
  const backup = result.data;
  const reader = new S3Client({
    endpoint: source.endpoint,
    region: source.region,
    forcePathStyle: source.forcePathStyle,
    credentials: { accessKeyId: source.accessKeyId, secretAccessKey: source.secretAccessKey },
  });
  const writer = new S3Client({
    endpoint: backup.BACKUP_S3_ENDPOINT,
    region: backup.BACKUP_S3_REGION,
    credentials: { accessKeyId: backup.BACKUP_S3_ACCESS_KEY_ID, secretAccessKey: backup.BACKUP_S3_SECRET_ACCESS_KEY },
  });
  try {
    const summary = await backupDocuments({
      source: reader,
      destination: writer,
      sourceBucket: source.bucket,
      destinationBucket: backup.BACKUP_S3_BUCKET,
      sourcePrefix: source.prefix,
    });
    // Counts only: never log document paths, contents or credentials.
    console.log("[document backup] completed", JSON.stringify(summary));
  } finally {
    reader.destroy();
    writer.destroy();
  }
}

main().catch((error: unknown) => {
  console.error("[document backup] failed:", error instanceof Error ? error.name : "UnknownError");
  process.exitCode = 1;
});
