CREATE TABLE IF NOT EXISTS communication_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'broadcast')),
    channel TEXT NOT NULL,
    from_unit TEXT NOT NULL,
    to_unit TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('routine', 'priority', 'urgent', 'distress')),
    status TEXT NOT NULL CHECK (status IN ('received', 'acknowledged', 'sent', 'failed')),
    acknowledged_at TIMESTAMPTZ,
    linked_incident_id UUID,
    operator TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_communication_events_occurred_at ON communication_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_events_incident ON communication_events (linked_incident_id);

CREATE TABLE IF NOT EXISTS audio_dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 1 AND 300),
    channel TEXT NOT NULL,
    from_unit TEXT NOT NULL,
    to_unit TEXT NOT NULL,
    transcript TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('playing', 'queued', 'played')),
    linked_incident_id UUID,
    waveform JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audio_dispatch_items_started_at ON audio_dispatch_items (started_at DESC);
