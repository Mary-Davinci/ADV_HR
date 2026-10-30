import { createHash, randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

const SNAPSHOT_ROOT = "snapshots/";
const MAX_BACKUP_OBJECT_BYTES = 64 * 1024 * 1024;
const BATCH_MEMORY_BYTES = 32 * 1024 * 1024;
const MAX_PARALLEL_COPIES = 4;
type SourceObject = { Key?: string; ETag?: string; Size?: number };

export interface DocumentBackupOptions {
  source: S3Client;
  destination: S3Client;
  sourceBucket: string;
  destinationBucket: string;
  sourcePrefix: string;
  now?: Date;
  retentionDays?: number;
}

/** Independent, complete snapshots. Only an explicitly separate backup bucket is writable. */
export async function backupDocuments(options: DocumentBackupOptions) {
  const { source, destination, sourceBucket, destinationBucket, sourcePrefix } = options;
  if (sourceBucket === destinationBucket) throw new Error("Backup bucket must be separate from source");
  if (!sourcePrefix || !sourcePrefix.endsWith("/")) throw new Error("A document prefix is required");
  const now = options.now ?? new Date();
  const retentionDays = options.retentionDays ?? 7;
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 30) throw new Error("Invalid retention");
  const prefix = `${SNAPSHOT_ROOT}${now.toISOString().slice(0, 10)}/${randomUUID()}/`;
  const manifest: { key: string; size: number; sha256: string }[] = [];
  let bytesCopied = 0;
  let token: string | undefined;
  async function copyObject(object: SourceObject) {
    if (
      !object.Key ||
      !object.Key.startsWith(sourcePrefix) ||
      !object.ETag ||
      object.Size === undefined ||
      object.Size > MAX_BACKUP_OBJECT_BYTES
    )
      throw new Error("Unsupported source object");
    const response = await source.send(
      new GetObjectCommand({ Bucket: sourceBucket, Key: object.Key, IfMatch: object.ETag }),
      { abortSignal: AbortSignal.timeout(60_000) },
    );
    if (!response.Body || response.ContentLength !== object.Size) throw new Error("Source changed during snapshot");
    const content = await response.Body.transformToByteArray();
    if (content.byteLength !== object.Size) throw new Error("Incomplete source document");
    await destination.send(
      new PutObjectCommand({
        Bucket: destinationBucket,
        Key: `${prefix}${object.Key}`,
        Body: content,
        ContentLength: content.byteLength,
        ContentType: response.ContentType,
      }),
      { abortSignal: AbortSignal.timeout(60_000) },
    );
    manifest.push({
      key: object.Key,
      size: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
    bytesCopied += content.byteLength;
  }
  async function copyBatch(objects: SourceObject[]) {
    // Await every in-flight copy before reporting failure and closing the clients.
    const results = await Promise.allSettled(objects.map(copyObject));
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }
  do {
    const page = await source.send(
      new ListObjectsV2Command({ Bucket: sourceBucket, Prefix: sourcePrefix, ContinuationToken: token }),
      { abortSignal: AbortSignal.timeout(60_000) },
    );
    let batch: SourceObject[] = [];
    let batchBytes = 0;
    for (const object of page.Contents ?? []) {
      if (!object.Key || object.Key.endsWith("/")) continue;
      if (
        batch.length &&
        (batch.length >= MAX_PARALLEL_COPIES || batchBytes + (object.Size ?? 0) > BATCH_MEMORY_BYTES)
      ) {
        await copyBatch(batch);
        batch = [];
        batchBytes = 0;
      }
      batch.push(object);
      batchBytes += object.Size ?? 0;
    }
    await copyBatch(batch);
    token = page.NextContinuationToken;
    if (page.IsTruncated && !token) throw new Error("Incomplete source listing");
  } while (token);
  // Written last: an interrupted or failed snapshot never counts as complete.
  await destination.send(
    new PutObjectCommand({
      Bucket: destinationBucket,
      Key: `${prefix}manifest.json`,
      Body: JSON.stringify({ version: 1, createdAt: now.toISOString(), sourceBucket, documents: manifest }),
      ContentType: "application/json",
    }),
  );
  if (manifest.length === 0) return { documents: 0, bytesCopied: 0, expiredObjectsRemoved: 0 };

  // Retention runs only after a successful snapshot. Never delete from the source.
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000).toISOString().slice(0, 10);
  const expired: string[] = [];
  do {
    const page = await destination.send(
      new ListObjectsV2Command({ Bucket: destinationBucket, Prefix: SNAPSHOT_ROOT, ContinuationToken: token }),
    );
    for (const object of page.Contents ?? []) {
      const match = object.Key?.match(/^snapshots\/(\d{4}-\d{2}-\d{2})\/[a-f0-9-]{36}\//);
      if (match && match[1]! < cutoff) expired.push(object.Key!);
    }
    token = page.NextContinuationToken;
    if (page.IsTruncated && !token) throw new Error("Incomplete backup listing");
  } while (token);
  for (const key of expired) await destination.send(new DeleteObjectCommand({ Bucket: destinationBucket, Key: key }));
  return { documents: manifest.length, bytesCopied, expiredObjectsRemoved: expired.length };
}
