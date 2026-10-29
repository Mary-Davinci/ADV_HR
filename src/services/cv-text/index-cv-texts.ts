import { sql } from "drizzle-orm";

import type { Database } from "@/repositories/postgres";

import type { DocumentStorage } from "../storage/document-storage";
import { extractCvText, type ExtractionStatus } from "./extract-text";

export interface CvIndexSummary {
  processed: number;
  byStatus: Record<ExtractionStatus | "MISSING_FILE", number>;
}

/**
 * Estrae e indicizza il testo dei CV non ancora elaborati (incrementale:
 * ogni documento si elabora una volta; se il file cambia, il documento
 * viene ricreato dalla sincronizzazione e torna da elaborare).
 * Nei log solo conteggi: mai nomi o contenuti.
 */
export async function indexCandidateCvTexts(options: {
  db: Database;
  storage: DocumentStorage;
  limit?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<CvIndexSummary> {
  const { db, storage } = options;
  type Row = { id: string; candidate_id: string; storage_key: string; mime_type: string };
  const pending = (await db.execute(sql`
    SELECT d.id, d.candidate_id, d.storage_key, d.mime_type
    FROM documents d
    LEFT JOIN candidate_document_texts t ON t.document_id = d.id
    WHERE d.type = 'CV' AND d.candidate_id IS NOT NULL AND t.document_id IS NULL
      AND d.storage_provider = ${storage.provider}
    ORDER BY d.created_at DESC
    LIMIT ${options.limit ?? 100_000}
  `)) as unknown as { rows: Row[] };
  const queue = [...pending.rows];
  const total = queue.length;
  const summary: CvIndexSummary = {
    processed: 0,
    byStatus: { OK: 0, EMPTY: 0, UNSUPPORTED: 0, FAILED: 0, MISSING_FILE: 0 },
  };

  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const bytes = await storage.get(job.storage_key);
      const extracted = bytes ? await extractCvText(bytes, job.mime_type) : null;
      const status = extracted?.status ?? "FAILED";
      const text = extracted?.text ?? "";
      await db.execute(sql`
        INSERT INTO candidate_document_texts (document_id, candidate_id, status, content, char_count, search_vector)
        VALUES (${job.id}, ${job.candidate_id}, ${status}, ${text}, ${text.length},
                CASE WHEN ${text} = '' THEN NULL ELSE to_tsvector('italian', unaccent(${text})) END)
        ON CONFLICT (document_id) DO NOTHING
      `);
      summary.byStatus[bytes ? status : "MISSING_FILE"]++;
      summary.processed++;
      options.onProgress?.(summary.processed, total);
    }
  };
  await Promise.all(Array.from({ length: options.concurrency ?? 3 }, worker));
  return summary;
}
