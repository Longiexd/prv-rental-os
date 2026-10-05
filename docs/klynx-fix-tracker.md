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
| Fleet cards, draft visibility and availability lifecycle | Reapplied on the repaired baseline; locally verified and packaged separately; awaiting staging deployment and live verification |
| Booking-specific return, mileage, notes and operational state | Saved separately; incomplete and not shipped |
| Unpaid invoice filtering | Pending |
| Booking-to-prospect stages and explicit handover | Pending |
| Contract template/action | Pending |
| Customer and vehicle document tracking | Pending |
| Maintenance/vidange reminders | Pending |
| Attention-menu clipping and light-mode contrast | Pending |

Each block should have its own reviewed commit and ZIP. Validate the exact candidate before pushing. No new credentials or authentication changes are required for these blocks.

## Fleet Block 01 verification

- Cards are the default. Quotations appear separately and never become the active rental or block availability.
- Confirmed bookings reserve; actual handover marks rented; overdue unreturned bookings show return due. Cancellation and return no longer drive booking states.
- Sync clears stale booking states while preserving cleaning and maintenance. Booking edits retain pickup/return times and refresh the linked vehicles.
- Shared booking policy lives in `app/core`; vehicle rules live in `app/verticals/car_rental`.
- Existing sales response and its default 100-record limit remain. The fleet uses an additive `for_fleet=true` query to include older open bookings.
- Backend: 159 passed, 5 Linux-only installer tests skipped on Windows, one existing Starlette warning. Frontend/proxy/Worker policy: 25 passed. TypeScript and actionlint passed.
- CI and staging deployment now run the new fleet tests. The deployment installer, Odoo connectivity repair, authentication, registry, and proxy code are unchanged.
- Full Worker build and live Odoo workflow remain to be verified by staging CI and the agent after deployment; local sandbox previously blocked the build. Return mileage/notes and CRM stage synchronization remain separate pending blocks.
