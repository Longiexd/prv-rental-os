# Klynx updates from the verified staging baseline

Stable baseline: `f5681bd` (deployment repair), following rollback `5800875`.
The user confirmed login works and staging deploys without errors. Linux Docker validation passed 128 tests.
Authentication, registry, proxy, runtime keys, and repaired deployment routing are protected from unrelated changes.

## Actions cleanup

- Removed redundant standalone CI pushes on staging: staging deployment already runs backend tests, frontend build/proxy checks, and tenant integration.
- Retained both existing PR validation workflows and their check names, and standalone CI pushes on main.
- Cancel superseded CI runs and superseded PR tenant checks. Tenant checks called by staging deployment remain protected from cancellation by PR checks.
- Staging and production deployment workflows are unchanged; deployments remain serialized and are not cancelled mid-install.
- With an open PR from staging, one push now creates three top-level runs rather than four: CI for the PR, tenant integration for the PR, and staging deployment. A staging push without an open PR creates only staging deployment.
- PR and deployment validation intentionally remain independent. Historical runs are retained.

## Feature blocks

| Block | Status |
| --- | --- |
| Fleet cards, draft visibility and availability lifecycle | Original implementation retained in Git; must reapply and verify on this baseline before return-mileage work |
| Booking-specific return, mileage, notes and operational state | Saved separately; incomplete and not shipped |
| Unpaid invoice filtering | Pending |
| Booking-to-prospect stages and explicit handover | Pending |
| Contract template/action | Pending |
| Customer and vehicle document tracking | Pending |
| Maintenance/vidange reminders | Pending |
| Attention-menu clipping and light-mode contrast | Pending |

Each block should have its own reviewed commit and ZIP. Validate the exact candidate before pushing. No new credentials or authentication changes are required for these blocks.
