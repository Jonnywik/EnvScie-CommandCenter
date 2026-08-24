BEGIN;

CREATE TABLE IF NOT EXISTS cfr.incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'escalated', 'stabilized', 'closed', 'reopened')),
    severity text NOT NULL,
    emergency_type text NOT NULL,
    barangay text NOT NULL,
    summary text NOT NULL,
    follow_up_owner text,
    follow_up_due_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cfr.incident_sos_links (
    incident_id uuid NOT NULL REFERENCES cfr.incidents(id) ON DELETE CASCADE,
    sos_id uuid NOT NULL REFERENCES cfr.sos_requests(id) ON DELETE RESTRICT,
    linked_at timestamptz NOT NULL DEFAULT now(),
    linked_by_user_id uuid REFERENCES cfr.app_users(id) ON DELETE SET NULL,
    PRIMARY KEY (incident_id, sos_id)
);

CREATE TABLE IF NOT EXISTS cfr.incident_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id uuid NOT NULL REFERENCES cfr.incidents(id) ON DELETE CASCADE,
    action text NOT NULL,
    from_status text,
    to_status text NOT NULL,
    note text,
    actor_user_id uuid REFERENCES cfr.app_users(id) ON DELETE SET NULL,
    actor_role text,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_status_updated_idx ON cfr.incidents (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS incident_events_incident_time_idx ON cfr.incident_events (incident_id, occurred_at DESC);
COMMIT;
