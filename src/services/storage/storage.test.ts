import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { LocalFileStorage } from "./document-storage";
import { S3Storage, type S3Sender, type S3StorageConfig } from "./s3-storage";
import { createDocumentStorage, readStorageConfig } from "./storage-config";

const config: S3StorageConfig = {
  bucket: "adv-hr-documents-abc123",
  endpoint: "https://t3.storageapi.dev",
  region: "auto",
  accessKeyId: "key-id",
  secretAccessKey: "secret",
  forcePathStyle: false,
  prefix: "documents/",
};

function notFound(name: string) {
  return Object.assign(new Error(name), { name, $metadata: { httpStatusCode: 404 } });
}

/** Finto bucket in memoria: risponde ai comandi come farebbe S3. */
function fakeBucket() {
  const objects = new Map<string, Uint8Array>();
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof PutObjectCommand) {
      objects.set(command.input.Key!, command.input.Body as Uint8Array);
      return {};
    }
    if (command instanceof GetObjectCommand) {
      const body = objects.get(command.input.Key!);
      if (!body) throw notFound("NoSuchKey");
      return { Body: { transformToByteArray: async () => body } };
    }
    if (command instanceof HeadObjectCommand) {
      const body = objects.get(command.input.Key!);
      if (!body) throw notFound("NotFound");
      return { ContentLength: body.byteLength };
    }
    objects.delete((command as { input: { Key: string } }).input.Key);
    return {};
  });
  return { objects, client: { send } as unknown as S3Sender };
}

describe("S3Storage", () => {
  it("salva, legge ed elimina con il prefisso nel bucket configurato", async () => {
    const { objects, client } = fakeBucket();
    const storage = new S3Storage(config, client);
    const content = new TextEncoder().encode("cv");

    await storage.put("2026/10/0b6f5c1e-9d2a-4f7e-8a51-3c2d1e0f9a8b", content);
    expect([...objects.keys()]).toEqual(["documents/2026/10/0b6f5c1e-9d2a-4f7e-8a51-3c2d1e0f9a8b"]);
    expect(await storage.get("2026/10/0b6f5c1e-9d2a-4f7e-8a51-3c2d1e0f9a8b")).toEqual(content);
    expect(await storage.size("2026/10/0b6f5c1e-9d2a-4f7e-8a51-3c2d1e0f9a8b")).toBe(2);

    await storage.delete("2026/10/0b6f5c1e-9d2a-4f7e-8a51-3c2d1e0f9a8b");
    expect(objects.size).toBe(0);
  });

  it("restituisce null per un oggetto inesistente", async () => {
    const storage = new S3Storage(config, fakeBucket().client);
    expect(await storage.get("2026/10/manca")).toBeNull();
    expect(await storage.size("2026/10/manca")).toBeNull();
  });

  it("propaga gli altri errori del bucket", async () => {
    const client = { send: vi.fn().mockRejectedValue(new Error("AccessDenied")) } as unknown as S3Sender;
    await expect(new S3Storage(config, client).get("2026/10/x")).rejects.toThrow("AccessDenied");
  });

  it("rifiuta chiavi non sicure prima di chiamare il bucket", async () => {
    const { client } = fakeBucket();
    const storage = new S3Storage(config, client);
    await expect(storage.put("../segreti", new Uint8Array([1]))).rejects.toThrow("Chiave di storage non valida");
    expect(client.send).not.toHaveBeenCalled();
  });
});

describe("readStorageConfig", () => {
  it("usa lo storage locale per default", () => {
    expect(readStorageConfig({})).toEqual({ provider: "local", dir: "./storage/documents" });
    expect(createDocumentStorage(readStorageConfig({}))).toBeInstanceOf(LocalFileStorage);
  });

  it("legge la configurazione S3 di Railway", () => {
    const parsed = readStorageConfig({
      DOCUMENT_STORAGE_PROVIDER: "s3",
      S3_BUCKET: config.bucket,
      S3_ENDPOINT: config.endpoint,
      S3_ACCESS_KEY_ID: "key-id",
      S3_SECRET_ACCESS_KEY: "secret",
    });
    expect(parsed).toEqual({ provider: "s3", ...config });
    expect(createDocumentStorage(parsed).provider).toBe("S3");
  });

  it("segnala le variabili S3 mancanti senza mostrarne i valori", () => {
    expect(() =>
      readStorageConfig({ DOCUMENT_STORAGE_PROVIDER: "s3", S3_BUCKET: "b", S3_SECRET_ACCESS_KEY: "segretissima" }),
    ).toThrow(/S3_ACCESS_KEY_ID è obbligatoria/);
    expect(() =>
      readStorageConfig({ DOCUMENT_STORAGE_PROVIDER: "s3", S3_BUCKET: "b", S3_SECRET_ACCESS_KEY: "segretissima" }),
    ).not.toThrow(/segretissima/);
  });
});
