-- A single SOS may have one unresolved dispatch lifecycle at a time.
-- Cancelled and closed records remain available for audit and allow a later, human-reviewed proposal.
-- Do not silently close or choose among historical competing records; resolve them through the
-- existing lifecycle process before applying this guard.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM cfr.response_group_assignments
        WHERE target_type = 'sos_request'
          AND lifecycle_status IN ('pending_confirmation', 'confirmed', 'acknowledged', 'escalated')
        GROUP BY target_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot enforce one open SOS dispatch assignment while historical competing active assignments remain; review and cancel or close the superseded lifecycle records first.';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS response_group_assignments_one_open_sos_idx
    ON cfr.response_group_assignments (target_type, target_id)
    WHERE target_type = 'sos_request'
      AND lifecycle_status IN ('pending_confirmation', 'confirmed', 'acknowledged', 'escalated');

COMMIT;
