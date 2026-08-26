# Code for Resilience — Balangiga civilian companion

Code for Resilience — Balangiga civilian companion is the **mobile-first civilian web companion** within the Code for Resilience project group. It focuses on Balangiga, Eastern Samar, with preparedness guidance, incident reporting, safe routing, evacuation-center context, resident SOS workflows, and privacy-first Emergency Circles.

The application is maintained as a distinct React, Vite, tRPC, and Drizzle project under `mobile/harborline-web` so that it can evolve alongside, rather than replace, the Expo resident client in `mobile`.

## Included capability areas

| Area | Scope |
| --- | --- |
| Resident information | English, Filipino, and Waray interface support; accessibility, theme, and text-scale preferences |
| Crisis support | Crisis map, directions, verified evacuation-center context, safe routes, incident reports, and resident SOS workflows |
| Trusted circles | Owner-reviewed membership, expiring consent-based location sharing, safety statuses, Circle SOS, member removal, and invite-code rotation |
| Engineering | TypeScript source, Drizzle migrations, tRPC procedures, tests, and visual-verification notes |

> This companion remains a development and pilot foundation. It does not itself confirm emergency-service dispatch or provide background location tracking.

For project-specific scripts and local setup, see `package.json` in this folder.
