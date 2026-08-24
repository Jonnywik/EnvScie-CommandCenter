-- Role-level roster records support accountability without storing individual personnel names in the command snapshot.
BEGIN;
SET search_path = cfr, public;

CREATE TABLE IF NOT EXISTS response_group_roster (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_unit_id uuid NOT NULL REFERENCES resource_units(id) ON DELETE CASCADE,
    role_title text NOT NULL,
    personnel_count integer NOT NULL CHECK (personnel_count >= 1),
    readiness text NOT NULL DEFAULT 'unconfirmed' CHECK (readiness IN ('ready', 'limited', 'unconfirmed')),
    source_reference text,
    verified_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (resource_unit_id, role_title)
);
CREATE INDEX IF NOT EXISTS response_group_roster_resource_idx ON response_group_roster(resource_unit_id);
COMMIT;
