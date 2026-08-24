BEGIN;

ALTER TABLE cfr.facility_verifications
    ADD COLUMN IF NOT EXISTS source_document_reference text NOT NULL DEFAULT 'Official registry reference; verify original source before operational use',
    ADD COLUMN IF NOT EXISTS revalidation_due_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');

ALTER TABLE cfr.facility_verifications
    DROP CONSTRAINT IF EXISTS facility_verifications_revalidation_after_verification;

ALTER TABLE cfr.facility_verifications
    ADD CONSTRAINT facility_verifications_revalidation_after_verification
    CHECK (revalidation_due_at >= verified_at);

CREATE INDEX IF NOT EXISTS facility_verifications_revalidation_due_idx
    ON cfr.facility_verifications (revalidation_due_at);

COMMIT;
