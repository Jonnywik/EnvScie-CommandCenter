BEGIN;
SET search_path = cfr, public;

CREATE TABLE IF NOT EXISTS external_feed_sources (
    source_name         text PRIMARY KEY,
    endpoint_url        text,
    etag                text,
    last_modified       text,
    last_success_at     timestamptz,
    last_error_at       timestamptz,
    last_error          text,
    last_content_hash   text,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_feed_runs (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_name         text NOT NULL REFERENCES external_feed_sources(source_name) ON DELETE CASCADE,
    run_status          text NOT NULL CHECK (run_status IN ('started', 'succeeded', 'failed')),
    items_seen          integer NOT NULL DEFAULT 0,
    items_inserted      integer NOT NULL DEFAULT 0,
    items_updated       integer NOT NULL DEFAULT 0,
    error_message       text,
    started_at          timestamptz NOT NULL DEFAULT now(),
    finished_at         timestamptz
);

CREATE INDEX IF NOT EXISTS external_feed_runs_source_idx
    ON external_feed_runs (source_name, started_at DESC);

COMMIT;
