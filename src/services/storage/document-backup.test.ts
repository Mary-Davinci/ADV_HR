import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { backupDocuments } from "./document-backup";

const NOW = new Date("2026-10-30T02:00:00Z");
const OLD = "snapshots/2026-10-01/00000000-0000-0000-0000-000000000001/documents/old";

function clients(fail = false, empty = false) {
  const events: string[] = [];
  const documents = new Map([
    ["documents/2026/10/first", new Uint8Array([1, 2, 3])],
    ["documents/2026/10/second", new Uint8Array([4, 5])],
  ]);
  const stored = new Map<string, Uint8Array | string>([
    [OLD, "old"],
    ["unrelated/object", "keep"],
  ]);
  const sourceSend = vi.fn(async (command: unknown) => {
    if (command instanceof ListObjectsV2Command) {
      const keys = [...documents.keys()];
      const index = command.input.ContinuationToken ? 1 : 0;
      return {
        Contents: empty ? [] : [{ Key: keys[index], Size: documents.get(keys[index]!)!.length, ETag: '"etag"' }],
        NextContinuationToken: !empty && index === 0 ? "page2" : undefined,
      };
    }
    if (command instanceof GetObjectCommand) {
      if (fail) throw new Error("Storage unavailable");
      expect(command.input.IfMatch).toBe('"etag"');
      const content = documents.get(command.input.Key!)!;
      return { ContentLength: content.length, Body: { transformToByteArray: async () => content } };
    }
    throw new Error("Source must never be written or deleted");
  });
  const destinationSend = vi.fn(async (command: unknown) => {
    if (command instanceof PutObjectCommand) {
      stored.set(command.input.Key!, command.input.Body as Uint8Array | string);
      events.push(command.input.Key!.endsWith("manifest.json") ? "manifest" : "copy");
      return {};
    }
    if (command instanceof ListObjectsV2Command) return { Contents: [...stored.keys()].map((Key) => ({ Key })) };
    if (command instanceof DeleteObjectCommand) {
      stored.delete(command.input.Key!);
      events.push("delete");
      return {};
    }
    throw new Error("Unexpected backup command");
  });
  return {
    source: { send: sourceSend } as unknown as S3Client,
    destination: { send: destinationSend } as unknown as S3Client,
    stored,
    events,
    sourceSend,
  };
}

describe("independent document snapshots", () => {
  it("copies all pages, writes a complete manifest last and expires only old backup objects", async () => {
    const state = clients();
    expect(
      await backupDocuments({
        ...state,
        sourceBucket: "source",
        destinationBucket: "backup",
        sourcePrefix: "documents/",
        now: NOW,
      }),
    ).toEqual({ documents: 2, bytesCopied: 5, expiredObjectsRemoved: 1 });
    expect(state.events).toEqual(["copy", "copy", "manifest", "delete"]);
    expect(state.stored.has(OLD)).toBe(false);
    expect(state.stored.get("unrelated/object")).toBe("keep");
    const manifest = [...state.stored.entries()].find(([key]) => key.endsWith("manifest.json"))!;
    const data = JSON.parse(manifest[1] as string);
    expect(data.documents).toHaveLength(2);
    expect(data.documents[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retains existing backups and never marks a failed run complete", async () => {
    const state = clients(true);
    await expect(
      backupDocuments({
        ...state,
        sourceBucket: "source",
        destinationBucket: "backup",
        sourcePrefix: "documents/",
        now: NOW,
      }),
    ).rejects.toThrow("Storage unavailable");
    expect(state.stored.has(OLD)).toBe(true);
    expect(state.events).toEqual([]);
  });

  it("does not prune backups when the source unexpectedly contains no documents", async () => {
    const state = clients(false, true);
    await backupDocuments({
      ...state,
      sourceBucket: "source",
      destinationBucket: "backup",
      sourcePrefix: "documents/",
      now: NOW,
    });
    expect(state.stored.has(OLD)).toBe(true);
    expect(state.events).toEqual(["manifest"]);
  });

  it("refuses to write snapshots into the source bucket", async () => {
    const state = clients();
    await expect(
      backupDocuments({
        ...state,
        sourceBucket: "source",
        destinationBucket: "source",
        sourcePrefix: "documents/",
        now: NOW,
      }),
    ).rejects.toThrow("separate");
    expect(state.sourceSend).not.toHaveBeenCalled();
  });
});
