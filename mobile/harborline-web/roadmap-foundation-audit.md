# Approved Roadmap Foundation Audit

## Existing foundations

Harborline already has an evacuation-center table with operational status, slots, contact number, and flexible accessibility metadata. Center records are exposed through a typed public listing endpoint and refreshed by Directions every 30 seconds. Existing operations views can update capacity/status, publish LGU road closures, issue an alert record, and review recent incident reports. Notification events and delivery rows provide a basic durable outbox, while resident preferences, language, layer controls, and accessibility options are locally persistent.

## Gaps to close before operational use

The evacuation record does not yet include a source, verifier, freshness window, medical-support profile, or controlled publication history. The generic center-status mutation does not enforce the same administrator guard already used for closure publication. The current fallback roster is intentionally reference-only, so the user interface needs a typed trust state rather than relying on informal copy. The application has local offline preferences and selected map fallbacks, but no versioned PWA cache, emergency-pack manifest, or resident-visible outbound queue state. Notification delivery rows exist but do not yet include resident opt-in or subscription handling.

## Implementation boundary

No supplied LGU roster or authorized live feed exists in the project. Therefore, all new operational records default to **reference** until an authorized operations user verifies and publishes them. The implementation will preserve the user-visible verification requirement instead of inventing live capacity, medical, or accessibility data.
