# Cross-Browser Navigation Visual Regression

## Scope and method

The hosted Command Center was captured through **Chromium**, **Firefox**, and **WebKit** using the same production URL. Each engine rendered the Command Map with the navigation expanded and collapsed at **1440 × 900**, plus the responsive navigation treatment at **768 × 1024** and **390 × 844**. The capture harness checked rail presence, tab count, active state, collapse state, accessible collapse label, measured geometry, and document overflow; representative screenshots were also visually reviewed.

| Browser engine | Desktop expanded | Desktop collapsed | Tablet | Mobile | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Chromium | Passed | Passed | Passed | Passed | No overflow or navigation-layout discrepancy observed |
| Firefox | Passed | Passed | Passed | Passed | No overflow or navigation-layout discrepancy observed |
| WebKit | Passed | Passed | Passed | Passed | No overflow or navigation-layout discrepancy observed |

## Measured navigation behavior

| Viewport and state | Expected layout | Observed result across all three engines |
| --- | --- | --- |
| Desktop, expanded | 248px labeled side rail | 248px navigation width; workspace began at x=248; exactly 12 tabs and one active item |
| Desktop, collapsed | 68px icon rail | 68px navigation width; workspace began at x=68; exactly 12 tabs and one active item |
| Tablet | Responsive horizontal tab strip | Main workspace retained full viewport width; no document overflow |
| Mobile | Responsive horizontal tab strip | Main workspace retained full viewport width; no document overflow |

All 12 captures passed the automated geometry and state checks. The document width matched each viewport in every run, so no horizontal overflow was detected. Visual inspection of the representative captures confirmed that the expanded rail, collapsed icon rail, right-side map controls, responder radar, and broadcast-draft entry remained separated and visible.

## Artifacts

The raw per-engine screenshots and structured results are stored in `docs/validation-assets/cross-browser-navigation/`. The artifact set contains 12 viewport screenshots and `audit-results.json`, which records the measured dimensions and state outcomes for each browser/viewport combination.
