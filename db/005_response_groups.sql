BEGIN;

ALTER TABLE resource_units
    ADD COLUMN IF NOT EXISTS agency text,
    ADD COLUMN IF NOT EXISTS group_type text,
    ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS readiness_score integer NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS personnel_ready integer NOT NULL DEFAULT 0 CHECK (personnel_ready >= 0),
    ADD COLUMN IF NOT EXISTS personnel_total integer NOT NULL DEFAULT 0 CHECK (personnel_total >= 0),
    ADD COLUMN IF NOT EXISTS call_sign text,
    ADD COLUMN IF NOT EXISTS location_label text,
    ADD COLUMN IF NOT EXISTS location_source text NOT NULL DEFAULT 'last_known' CHECK (location_source IN ('gps', 'radio', 'manual', 'last_known')),
    ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS constraints text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS last_check_in_at timestamptz,
    ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS response_group_assignments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            uuid NOT NULL REFERENCES resource_units(id) ON DELETE CASCADE,
    target_type         text NOT NULL CHECK (target_type IN ('sos_request', 'task', 'barangay', 'evacuation_center')),
    target_id           text NOT NULL,
    assignment_note     text,
    assigned_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    assigned_at         timestamptz NOT NULL DEFAULT now(),
    released_at         timestamptz
);
CREATE INDEX IF NOT EXISTS response_group_assignments_active_idx
    ON response_group_assignments (group_id, assigned_at DESC)
    WHERE released_at IS NULL;

COMMIT;
