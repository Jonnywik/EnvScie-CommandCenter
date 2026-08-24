BEGIN;

ALTER TABLE cfr.response_group_assignments
    ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'pending_confirmation'
        CHECK (lifecycle_status IN ('pending_confirmation', 'confirmed', 'acknowledged', 'escalated', 'cancelled', 'closed')),
    ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
    ADD COLUMN IF NOT EXISTS confirmed_by_user_id uuid REFERENCES cfr.app_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
    ADD COLUMN IF NOT EXISTS acknowledged_by_user_id uuid REFERENCES cfr.app_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
    ADD COLUMN IF NOT EXISTS closed_at timestamptz,
    ADD COLUMN IF NOT EXISTS closure_note text;

UPDATE cfr.response_group_assignments
SET lifecycle_status = CASE
    WHEN released_at IS NOT NULL THEN 'closed'
    ELSE 'confirmed'
END
WHERE lifecycle_status = 'pending_confirmation'
  AND assigned_at < now();

CREATE TABLE IF NOT EXISTS cfr.response_group_assignment_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL REFERENCES cfr.response_group_assignments(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    from_status text,
    to_status text NOT NULL CHECK (to_status IN ('pending_confirmation', 'confirmed', 'acknowledged', 'escalated', 'cancelled', 'closed')),
    note text,
    actor_user_id uuid REFERENCES cfr.app_users(id) ON DELETE SET NULL,
    actor_role text,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS response_group_assignment_events_assignment_idx
    ON cfr.response_group_assignment_events (assignment_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS response_group_assignments_lifecycle_idx
    ON cfr.response_group_assignments (lifecycle_status, assigned_at DESC);

COMMIT;
