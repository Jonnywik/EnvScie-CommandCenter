-- Code for Resilience — Balangiga disaster-management schema
-- PostgreSQL 15+ / PostGIS 3.x

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS cfr;
SET search_path = cfr, public;

CREATE TYPE user_role AS ENUM ('resident', 'dispatcher', 'responder', 'admin');
CREATE TYPE center_status AS ENUM ('open', 'full', 'closed', 'unknown');
CREATE TYPE hazard_type AS ENUM ('flood', 'storm_surge', 'landslide', 'wind', 'other');
CREATE TYPE alert_severity AS ENUM ('info', 'advisory', 'watch', 'warning', 'critical');
CREATE TYPE sos_status AS ENUM ('received', 'acknowledged', 'dispatched', 'resolved', 'false_alarm');
CREATE TYPE sos_channel AS ENUM ('internet', 'sms', 'mesh', 'manual');

CREATE TABLE app_users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164          text UNIQUE,
    display_name        text,
    role                user_role NOT NULL DEFAULT 'resident',
    preferred_language  text NOT NULL DEFAULT 'en',
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);

CREATE TABLE registered_devices (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid REFERENCES app_users(id) ON DELETE SET NULL,
    device_public_id    text NOT NULL UNIQUE,
    platform            text NOT NULL CHECK (platform IN ('android', 'ios', 'web', 'unknown')),
    last_seen_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evacuation_centers (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_ref        text UNIQUE,
    name                text NOT NULL,
    address             text,
    barangay             text,
    contact_phone        text,
    capacity_total      integer NOT NULL CHECK (capacity_total >= 0),
    occupancy_current    integer NOT NULL DEFAULT 0 CHECK (occupancy_current >= 0),
    status               center_status NOT NULL DEFAULT 'unknown',
    amenities            jsonb NOT NULL DEFAULT '{}'::jsonb,
    source_name         text,
    source_updated_at   timestamptz,
    geom                geometry(Point, 4326) NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (occupancy_current <= capacity_total OR status = 'full')
);
CREATE INDEX evacuation_centers_geom_gix ON evacuation_centers USING gist (geom);
CREATE INDEX evacuation_centers_open_idx ON evacuation_centers (status) WHERE status IN ('open', 'unknown');

CREATE TABLE hazard_zones (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_ref        text,
    name                text NOT NULL,
    hazard               hazard_type NOT NULL,
    severity            alert_severity NOT NULL DEFAULT 'advisory',
    is_active           boolean NOT NULL DEFAULT true,
    valid_from          timestamptz NOT NULL DEFAULT now(),
    valid_until         timestamptz,
    source_name         text NOT NULL,
    source_version      text,
    properties          jsonb NOT NULL DEFAULT '{}'::jsonb,
    geom                geometry(MultiPolygon, 4326) NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE INDEX hazard_zones_geom_gix ON hazard_zones USING gist (geom);
CREATE INDEX hazard_zones_active_idx ON hazard_zones (hazard, is_active, valid_from, valid_until);

-- Routable road graph. Import road centerlines during map preparation.
CREATE TABLE road_segments (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_node           bigint NOT NULL,
    to_node             bigint NOT NULL,
    geom                geometry(LineString, 4326) NOT NULL,
    base_cost_seconds   double precision NOT NULL CHECK (base_cost_seconds > 0),
    max_speed_kph       double precision,
    is_one_way          boolean NOT NULL DEFAULT false,
    road_class          text,
    properties          jsonb NOT NULL DEFAULT '{}'::jsonb,
    CHECK (from_node <> to_node)
);
CREATE INDEX road_segments_geom_gix ON road_segments USING gist (geom);
CREATE INDEX road_segments_from_node_idx ON road_segments (from_node);
CREATE INDEX road_segments_to_node_idx ON road_segments (to_node);

CREATE TABLE verified_alerts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name         text NOT NULL,
    source_event_id     text NOT NULL,
    title               text NOT NULL,
    body                text NOT NULL,
    severity            alert_severity NOT NULL,
    hazard              hazard_type,
    issued_at           timestamptz NOT NULL,
    expires_at          timestamptz,
    affected_area       geometry(MultiPolygon, 4326),
    source_url           text,
    raw_payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    content_hash        text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_name, source_event_id),
    CHECK (expires_at IS NULL OR expires_at >= issued_at)
);
CREATE INDEX verified_alerts_area_gix ON verified_alerts USING gist (affected_area);
CREATE INDEX verified_alerts_current_idx ON verified_alerts (issued_at DESC, expires_at);

CREATE TABLE sos_requests (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid REFERENCES app_users(id) ON DELETE SET NULL,
    device_id           uuid REFERENCES registered_devices(id) ON DELETE SET NULL,
    sender_phone        text,
    channel             sos_channel NOT NULL,
    emergency_type      text NOT NULL,
    severity            alert_severity NOT NULL DEFAULT 'critical',
    status              sos_status NOT NULL DEFAULT 'received',
    message             text,
    location            geometry(Point, 4326) NOT NULL,
    accuracy_meters     double precision CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
    client_occurred_at  timestamptz NOT NULL,
    received_at         timestamptz NOT NULL DEFAULT now(),
    acknowledged_at     timestamptz,
    resolved_at         timestamptz,
    dedupe_key          text NOT NULL,
    raw_payload         text,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (dedupe_key)
);
CREATE INDEX sos_requests_location_gix ON sos_requests USING gist (location);
CREATE INDEX sos_requests_triage_idx ON sos_requests (status, severity, received_at DESC);
CREATE INDEX sos_requests_recent_idx ON sos_requests (received_at DESC);

CREATE TABLE sos_status_events (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sos_id              uuid NOT NULL REFERENCES sos_requests(id) ON DELETE CASCADE,
    from_status         sos_status,
    to_status           sos_status NOT NULL,
    actor_user_id       uuid REFERENCES app_users(id) ON DELETE SET NULL,
    note                text,
    created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sos_status_events_sos_idx ON sos_status_events (sos_id, created_at DESC);

CREATE TABLE offline_content_manifests (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_version      text NOT NULL UNIQUE,
    locale              text NOT NULL,
    sha256              text NOT NULL,
    object_url          text NOT NULL,
    published_at        timestamptz NOT NULL DEFAULT now(),
    is_current          boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX one_current_offline_manifest
    ON offline_content_manifests (locale) WHERE is_current;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER app_users_updated_at BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER centers_updated_at BEFORE UPDATE ON evacuation_centers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER hazards_updated_at BEFORE UPDATE ON hazard_zones
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER alerts_updated_at BEFORE UPDATE ON verified_alerts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- Operational notes:
-- * Run ANALYZE after bulk GIS imports.
-- * Normalize/validate incoming geometries with ST_MakeValid before insert.
-- * Reject or quarantine stale hazard polygons using source timestamps/versions.
-- * Use cached vector/raster tiles for map rendering; use this graph for route decisions.
