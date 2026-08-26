# Roadmap Dependency Register

## Deferred Operational Releases

The following approved roadmap improvements are deliberately **not activated** in the current public build because they require an accountable operating owner, live service configuration, or a policy decision that has not been supplied to the project. Harborline continues to show reference and confirmation states rather than simulate those services.

| Release area | Required input before activation | Current safe state |
|---|---|---|
| Opt-in device alert delivery | LGU alert authority, resident consent wording, supported delivery provider, and subscription retention rules | Operations alerts remain recorded through the existing delivery queue; no claim of resident push delivery is made |
| Offline emergency pack and durable queues | Cache scope, storage budget, sync/retry policy, and local emergency-content owner | Existing offline guidance and local preferences remain available; no unverified background-sync guarantee is displayed |
| Low-bandwidth map and incident follow-up | Accepted minimum map layer set, local tile/cache policy, incident reviewer workflow, and public-resolution policy | Crisis Map retains its separate free-map fallback and source-aware reference state |
| Expanded privacy, role, and diagnostics controls | Data-retention schedule, LGU role roster, evidence-access policy, and monitoring destination | Center and closure publication already require administrator authorization and now create audit entries |

## Activation Checklist

Before any deferred release is enabled, nominate the responsible LGU office and an operational owner, define the data source/freshness/expiry policy, approve consent and retention language, validate in a tabletop exercise, and verify that loss of the external service results in a clear fallback—not a misleading live state.
