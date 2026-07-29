-- FR-041 (SPEC-V1.md 22, 19.7): "Ett aktivt svar per person per forespørsel."
-- Drizzle sitt schema-API (src/db/schema.ts) støtter ikke betingede unike
-- indekser direkte, derfor håndskrevet her fremfor generert.
--
-- Betinget på lifecycle_status = 'submitted' slik at en respondent kan
-- trekke et svar (withdrawn) og sende et nytt uten å kollidere med det
-- gamle, trukne svaret.
CREATE UNIQUE INDEX "responses_active_per_respondent_idx"
  ON "responses" ("request_id", "respondent_id")
  WHERE "lifecycle_status" = 'submitted';
