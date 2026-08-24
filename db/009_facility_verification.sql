BEGIN;

CREATE TABLE IF NOT EXISTS cfr.facility_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id text NOT NULL,
    coordinate_confirmed boolean NOT NULL DEFAULT false,
    contact_attempted boolean NOT NULL DEFAULT false,
    reported_access text NOT NULL DEFAULT 'not_assessed'
        CHECK (reported_access IN ('not_assessed', 'reported_open', 'reported_restricted', 'reported_unavailable')),
    verification_outcome text NOT NULL
        CHECK (verification_outcome IN ('reference_verified', 'follow_up_required', 'not_verified')),
    verification_note text NOT NULL,
    verified_by_user_id uuid REFERENCES cfr.app_users(id) ON DELETE SET NULL,
    verified_by_role text,
    verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facility_verifications_facility_time_idx
    ON cfr.facility_verifications (facility_id, verified_at DESC);

COMMIT;
