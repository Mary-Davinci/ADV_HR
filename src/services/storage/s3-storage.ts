import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { assertSafeKey, type DocumentStorage } from "./document-storage";

export interface S3StorageConfig {
  bucket: string;
  /** Endpoint S3 compatibile (es. Railway Buckets: https://t3.storageapi.dev). Assente = AWS. */
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** true solo per i bucket che lo richiedono (la scheda Credentials di Railway lo indica). */
  forcePathStyle: boolean;
  /** Prefisso delle chiavi nel bucket, es. "documents/": lascia spazio ad altri usi (backup). */
  prefix: string;
}

/** Il sottoinsieme del client usato qui: nei test si inietta un finto `send`. */
export type S3Sender = Pick<S3Client, "send">;

/**
 * Storage su bucket S3 compatibile (Railway Buckets in produzione). Le chiavi
 * sono le stesse dello storage locale: la migrazione copia i file senza
 * toccare `documents.storage_key`.
 */
export class S3Storage implements DocumentStorage {
  readonly provider = "S3" as const;
  private readonly client: S3Sender;

  constructor(
    private readonly config: S3StorageConfig,
    client?: S3Sender,
  ) {
    this.client =
      client ??
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      });
  }

  private objectKey(key: string): string {
    assertSafeKey(key);
    return `${this.config.prefix}${key}`;
  }

  async put(key: string, content: Uint8Array): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.objectKey(key),
        Body: content,
        ContentLength: content.byteLength,
      }),
    );
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: this.objectKey(key) }),
      );
      return response.Body ? await response.Body.transformToByteArray() : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /** Dimensione dell'oggetto, null se non esiste (verifica dopo la migrazione). */
  async size(key: string): Promise<number | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: this.objectKey(key) }),
      );
      return response.ContentLength ?? null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: this.objectKey(key) }));
  }
}

function isNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return error.name === "NoSuchKey" || error.name === "NotFound" || status === 404;
}
