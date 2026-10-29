import { sql } from "drizzle-orm";

import type { EducationLevel } from "@/domain";

import type { CandidateSuggestion, CandidateSuggestionQuery, CandidateSuggestionRepository } from "../types";
import type { Database } from "./db";

interface SuggestionRow {
  candidate_id: string;
  first_name: string;
  last_name: string;
  residence_city: string | null;
  residence_province: string | null;
  same_province: boolean;
  same_region: boolean;
  job_region: string | null;
  best_level: EducationLevel | null;
  matched: string[] | null;
  has_cv: boolean;
  has_readable_cv: boolean;
  in_selection: boolean;
  total: number;
}

/** Parole chiave già normalizzate dal servizio: qui si tiene solo [a-z0-9] per sicurezza. */
const safeKeyword = (keyword: string) => keyword.toLowerCase().replace(/[^a-z0-9]/g, "");

export class PostgresCandidateSuggestionRepository implements CandidateSuggestionRepository {
  constructor(private readonly db: Database) {}

  async suggest(query: CandidateSuggestionQuery): Promise<{ total: number; items: CandidateSuggestion[] }> {
    const keywords = [...new Set(query.keywords.map(safeKeyword).filter((k) => k.length >= 3))];
    const tsQuery = keywords.join(" | ");
    const province = query.province.toUpperCase();

    const result = (await this.db.execute(sql`
      WITH job_region AS (
        SELECT p.residence_region AS region
        FROM candidate_profiles p
        WHERE upper(p.residence_province) = ${province} AND p.residence_region IS NOT NULL
        GROUP BY p.residence_region ORDER BY count(*) DESC LIMIT 1
      ),
      cv AS (
        SELECT t.candidate_id, max(ts_rank(t.search_vector, q.query)) AS rank
        FROM candidate_document_texts t, (SELECT to_tsquery('italian', unaccent(${tsQuery})) AS query) q
        WHERE ${tsQuery} <> '' AND t.search_vector @@ q.query
        GROUP BY t.candidate_id
      ),
      education AS (
        SELECT e.candidate_id,
               (array_agg(e.level ORDER BY array_position(
                  ARRAY['LOWER_SECONDARY','VOCATIONAL','UPPER_SECONDARY','POST_SECONDARY','BACHELOR','MASTER','DOCTORATE']::text[],
                  e.level::text) DESC NULLS LAST))[1] AS best_level
        FROM candidate_education e GROUP BY e.candidate_id
      ),
      removed AS (
        SELECT ct.candidate_id FROM candidate_tags ct JOIN tags t ON t.id = ct.tag_id WHERE t.slug = 'adv-core-rimosso'
      ),
      scored AS (
        SELECT c.id AS candidate_id, c.first_name, c.last_name, p.residence_city, p.residence_province,
               coalesce(upper(p.residence_province) = ${province}, false) AS same_province,
               coalesce(p.residence_region = (SELECT region FROM job_region), false) AS same_region,
               (SELECT region FROM job_region) AS job_region,
               ed.best_level, cv.rank AS cv_rank
        FROM candidates c
        JOIN candidate_profiles p ON p.candidate_id = c.id
        LEFT JOIN cv ON cv.candidate_id = c.id
        LEFT JOIN education ed ON ed.candidate_id = c.id
        WHERE c.id NOT IN (SELECT candidate_id FROM removed)
          AND (upper(p.residence_province) = ${province}
               OR p.residence_region = (SELECT region FROM job_region)
               OR cv.candidate_id IS NOT NULL)
      ),
      ranked AS (
        SELECT s.*, count(*) OVER ()::int AS total
        FROM scored s
        -- Criteri soddisfatti: riscontro nel CV (3), stessa provincia (2), stessa regione (1).
        ORDER BY ((s.cv_rank IS NOT NULL)::int * 3 + s.same_province::int * 2 + s.same_region::int) DESC,
                 s.cv_rank DESC NULLS LAST, s.last_name, s.first_name
        LIMIT ${query.limit ?? 50}
      )
      SELECT r.*,
        ARRAY(SELECT k FROM unnest(string_to_array(${keywords.join(",")}, ',')) k
              WHERE EXISTS (SELECT 1 FROM candidate_document_texts t
                            WHERE t.candidate_id = r.candidate_id
                              AND t.search_vector @@ to_tsquery('italian', unaccent(k)))) AS matched,
        EXISTS (SELECT 1 FROM documents d WHERE d.candidate_id = r.candidate_id AND d.type = 'CV') AS has_cv,
        EXISTS (SELECT 1 FROM candidate_document_texts t WHERE t.candidate_id = r.candidate_id AND t.status = 'OK')
          AS has_readable_cv,
        EXISTS (SELECT 1 FROM applications a
                WHERE a.candidate_id = r.candidate_id AND a.selection_id = ${query.selectionId ?? null}::uuid)
          AS in_selection
      FROM ranked r
    `)) as unknown as { rows: SuggestionRow[] };

    return {
      total: result.rows[0]?.total ?? 0,
      items: result.rows.map((row) => ({
        candidateId: row.candidate_id,
        firstName: row.first_name,
        lastName: row.last_name,
        residenceCity: row.residence_city,
        residenceProvince: row.residence_province,
        sameProvince: row.same_province,
        sameRegion: row.same_region,
        jobRegion: row.job_region,
        bestEducationLevel: row.best_level,
        matchedKeywords: row.matched ?? [],
        hasCv: row.has_cv,
        hasReadableCv: row.has_readable_cv,
        alreadyInSelection: row.in_selection,
      })),
    };
  }
}
