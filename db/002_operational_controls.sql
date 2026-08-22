BEGIN;
SET search_path = cfr, public;

ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS auth_subject text,
    ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_auth_subject_uidx
    ON app_users (auth_subject)
    WHERE auth_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_log (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id       uuid REFERENCES app_users(id) ON DELETE SET NULL,
    actor_role          user_role,
    action              text NOT NULL,
    resource_type       text NOT NULL,
    resource_id         text,
    request_id          text,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_resource_idx
    ON audit_log (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx
    ON audit_log (actor_user_id, created_at DESC);

COMMIT;
