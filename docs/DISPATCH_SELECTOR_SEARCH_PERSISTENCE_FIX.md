# Dispatch Selector Search Persistence Fix

## Issue

When a coordinator opened **Triage Queue → Dispatch response team** and entered a role or specialty query, the selector could close and return the view to Live SOS. The command-center refresh shortcut was observed after the selector interaction, indicating that the text-entry event was escaping the selector context.

## Correction

The selector now renders through a document-level React portal. Its click and pointer events are contained within the modal rather than being handled by the Triage Queue drawer backdrop. This ensures that search input, specialty filtering, roster expansion, and availability selection remain inside the dispatch-team selector.

The application’s existing operator keyboard handler already ignores events originating from inputs, textareas, selects, and editable elements. With the selector no longer nested inside the backdrop interaction boundary, entering role and specialty text now reaches the selector without closing the drawer or refreshing Live SOS.

## Validation

The frontend regression suite, TypeScript validation, and optimized production build passed. A hosted smoke test opened an acknowledged medical SOS, opened **Dispatch response team**, entered `water` in the role/specialty search field, and confirmed that the selector remained visible and filtered to **Delta Water Rescue**. No responder-team proposal or dispatch action was created during the search test.
