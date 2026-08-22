CREATE TABLE IF NOT EXISTS cfr.assignment_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES cfr.response_group_assignments(id) ON DELETE SET NULL,
    group_id UUID NOT NULL REFERENCES cfr.resource_units(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('sos_request', 'task', 'barangay', 'evacuation_center')),
    target_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'push', 'in_app')),
    status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'delivered', 'failed', 'acknowledged')),
    message TEXT NOT NULL,
    recipient_label TEXT NOT NULL,
    recipient_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error TEXT,
    assignment_note TEXT,
    actor_user_id UUID REFERENCES cfr.app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS assignment_notifications_recent_idx
    ON cfr.assignment_notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS assignment_notifications_pending_idx
    ON cfr.assignment_notifications (status, created_at DESC)
    WHERE status IN ('queued', 'sending', 'failed');
