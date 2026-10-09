-- Dati di riferimento necessari in ogni ambiente (non dati fittizi).
-- Idempotente: non sovrascrive label/posizioni personalizzate successivamente.

INSERT INTO "roles" ("code", "label") VALUES
  ('ADMIN', 'Amministratore'),
  ('HR_MANAGER', 'Responsabile HR'),
  ('RECRUITER', 'Recruiter'),
  ('VIEWER', 'Consultazione')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint

-- Pipeline iniziale. Modificabile da database: il codice non assume un insieme fisso.
INSERT INTO "recruiting_stages" ("code", "label", "position", "active", "is_terminal") VALUES
  ('NEW', 'Nuovo', 10, true, false),
  ('TO_REVIEW', 'Da revisionare', 20, true, false),
  ('CONTACTED', 'Contattato', 30, true, false),
  ('INTERVIEW_SCHEDULED', 'Colloquio programmato', 40, true, false),
  ('INTERVIEWED', 'Colloquio svolto', 50, true, false),
  ('SECOND_INTERVIEW', 'Secondo colloquio', 60, true, false),
  ('SELECTED', 'Selezionato', 70, true, true),
  ('REJECTED', 'Scartato', 80, true, true),
  ('ON_HOLD', 'In attesa', 90, true, false)
ON CONFLICT ("code") DO NOTHING;
