-- Live resource tracking and route verification extensions.
BEGIN;

ALTER TYPE hazard_type ADD VALUE IF NOT EXISTS 'road_closure';

CREATE TABLE resource_units (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_ref        text UNIQUE,
    label               text NOT NULL,
    kind                text NOT NULL CHECK (kind IN ('team', 'vehicle', 'boat', 'supply', 'medical', 'communications')),
    owner               text NOT NULL,
    state               text NOT NULL DEFAULT 'standby' CHECK (state IN ('ready', 'standby', 'en_route', 'deployed', 'stale', 'offline')),
    current_assignment  text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resource_positions (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resource_id         uuid NOT NULL REFERENCES resource_units(id) ON DELETE CASCADE,
    reported_at         timestamptz NOT NULL DEFAULT now(),
    source              text NOT NULL CHECK (source IN ('gps', 'manual', 'radio', 'sms')),
    geom                geometry(Point, 4326) NOT NULL,
    accuracy_meters     double precision CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
    heading_degrees     double precision CHECK (heading_degrees IS NULL OR (heading_degrees >= 0 AND heading_degrees <= 360)),
    speed_kph           double precision CHECK (speed_kph IS NULL OR (speed_kph >= 0 AND speed_kph <= 160)),
    battery_pct         integer CHECK (battery_pct IS NULL OR (battery_pct >= 0 AND battery_pct <= 100)),
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX resource_positions_geom_gix ON resource_positions USING gist (geom);
CREATE INDEX resource_positions_latest_idx ON resource_positions (resource_id, reported_at DESC);

CREATE TABLE route_verifications (
    id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    origin                  geometry(Point, 4326) NOT NULL,
    destination_center_id   uuid REFERENCES evacuation_centers(id) ON DELETE SET NULL,
    route_status             text NOT NULL CHECK (route_status IN ('safe', 'stale', 'blocked')),
    route_is_safe_as_of      timestamptz NOT NULL,
    avoided_hazard_count     integer NOT NULL DEFAULT 0 CHECK (avoided_hazard_count >= 0),
    blocked_segment_count    integer NOT NULL DEFAULT 0 CHECK (blocked_segment_count >= 0),
    route_geojson            jsonb NOT NULL,
    verified_by_user_id      uuid REFERENCES app_users(id) ON DELETE SET NULL,
    created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_verifications_origin_gix ON route_verifications USING gist (origin);

CREATE TRIGGER resource_units_updated_at BEFORE UPDATE ON resource_units
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
