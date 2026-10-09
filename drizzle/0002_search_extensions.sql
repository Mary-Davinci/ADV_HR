-- Ricerca testuale insensibile agli accenti ("Nicolò" = "nicolo").
-- unaccent è un'estensione contrib standard di PostgreSQL. Idempotente.
CREATE EXTENSION IF NOT EXISTS unaccent;
