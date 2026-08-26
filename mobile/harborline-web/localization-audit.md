# Harborline localization audit

| Route | Explicit locale-driven content | Filipino verification | Waray verification |
|---|---|---|---|
| `/` | Navigation, coverage strip, readiness hero, core action labels | Verified at mobile breakpoint | Verified through shared locale catalog |
| `/alerts` | Alert categories, guidance, offline messaging, primary actions | Verified at mobile breakpoint | Verified at mobile breakpoint |
| `/map` | Locator headings, LGU verification notices, map handoff and directory labels | Verified at mobile breakpoint | Verified through shared locale catalog |
| `/report` | Incident categories, photo evidence guidance, location status, safety warning, submit action | Verified through shared locale catalog | Verified at mobile breakpoint |
| `/prepare` | Checklist, family check-in, survival guides, guide controls | Verified at mobile breakpoint | Verified through shared locale catalog |
| `/volunteer` | Onboarding headings, labels, availability, skills, privacy and submit action | Verified through shared locale catalog | Verified at mobile breakpoint |
| `/settings` | Language, appearance, large-text and high-contrast labels and descriptions | Verified at mobile breakpoint | Verified at mobile breakpoint |
| `/plan` | Form fields, preview, empty states, print/download actions, downloaded HTML document | Verified at mobile breakpoint | Verified at mobile breakpoint |

The selected locale is stored on-device. Shared language content, preparedness guides, settings controls, and the printable emergency-plan document render from locale-specific copy. Remaining dynamic hazard, operator, or user-entered content is intentionally retained in its source language because it is supplied at runtime rather than authored as fixed interface copy.
