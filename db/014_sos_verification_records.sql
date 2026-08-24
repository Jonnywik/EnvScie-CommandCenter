CREATE TABLE IF NOT EXISTS cfr.sos_verification_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_id uuid NOT NULL REFERENCES cfr.sos_requests(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('location_callback', 'barangay_contact', 'field_report', 'official_source', 'other')),
    source_role text NOT NULL CHECK (char_length(source_role) BETWEEN 2 AND 120),
    contact_method text NOT NULL CHECK (char_length(contact_method) BETWEEN 2 AND 80),
    source_observed_at timestamptz,
    note text NOT NULL CHECK (char_length(note) BETWEEN 5 AND 1000),
    reference_number text CHECK (reference_number IS NULL OR char_length(reference_number) <= 160),
    recorded_by_user_id uuid REFERENCES cfr.app_users(id) ON DELETE SET NULL,
    recorded_by_role text,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    decision_limit text NOT NULL DEFAULT 'This is an operator-recorded verification input, not proof of field safety, dispatch authority, route clearance, or incident validity.'
);

CREATE INDEX IF NOT EXISTS sos_verification_records_sos_recorded_idx
    ON cfr.sos_verification_records (sos_id, recorded_at DESC);

COMMIT;
