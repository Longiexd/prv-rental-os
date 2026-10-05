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
| Booking-specific return, mileage, notes and operational state | Implemented and locally verified; awaiting staging deployment and live verification |
| Unpaid invoice filtering | Pending |
| Booking-to-prospect stages and explicit handover | Pending |
| Contract template/action | Pending |
| Customer and vehicle document tracking | Pending |
| Maintenance/vidange reminders | Pending |
| Attention-menu clipping and light-mode contrast | Fixed in a separate UI commit; automated contrast/position checks pass; live visual verification pending |

Each block should have its own reviewed commit and ZIP. Validate the exact candidate before pushing. No new credentials or authentication changes are required for these blocks.

## Fleet Block 01 verification

- Cards are the default. Quotations appear separately and never become the active rental or block availability.
- Confirmed bookings reserve; actual handover marks rented; overdue unreturned bookings show return due. Cancellation and return no longer drive booking states.
- Sync clears stale booking states while preserving cleaning and maintenance. Booking edits retain pickup/return times and refresh the linked vehicles.
- Shared booking policy lives in `app/core`; vehicle rules live in `app/verticals/car_rental`.
- Existing sales response and its default 100-record limit remain. The fleet uses an additive `for_fleet=true` query to include older open bookings.
- Backend: 159 passed, 5 Linux-only installer tests skipped on Windows, one existing Starlette warning. Frontend/proxy/Worker policy: 25 passed. TypeScript and actionlint passed.
- CI and staging deployment now run the new fleet tests. The deployment installer, Odoo connectivity repair, authentication, registry, and proxy code are unchanged.
- Full Worker build and live Odoo workflow remain to be verified by staging CI and the agent after deployment; local sandbox blocked the build. Return mileage/notes are delivered in Block 02 below; CRM stage synchronization remains a separate pending block.

## Return Block 02

- Overview, fleet, and rental detail actions open the same return form. Rental detail and overview preserve the exact booking identity; fleet requires selection if more than one collected booking exists.
- Record return odometer, return notes, damage notes, and Nettoyage / Disponible / Maintenance. Notes remain plain text in the UI; units follow the vehicle. The existing Odoo odometer inverse records mileage history.
- Only the selected collected confirmed booking is completed. Its financial records and future bookings remain intact. New explicit-booking requests require mileage; older next-state-only callers retain their existing reading when exactly one booking is eligible.
- A bounded core metadata helper stores structured return data alongside existing Odoo note markers; no schema change is required. Vehicle-specific policy remains in the car-rental vertical module.
- Saved pending returns support retries across separate Odoo RPCs. Failed/false writes do not report completion; equal-reading and completed retries avoid repeated odometer history and preserve subsequent manual vehicle changes. Corrupt or inconsistent saved returns are rejected for review.
- Validation: 197 backend tests passed, 5 Linux-only tests skipped; 34 frontend/proxy/Worker tests passed; TypeScript, workflow lint, and diff checks passed. One existing Starlette warning remains. Staging CI and live Odoo verification are still required.
- Separate RPCs are recoverable, not a cross-record database transaction. Simultaneous changes by another agent still require review. No authentication, proxy, registry, credentials, or repaired installer changes.

## Light-mode readability and attention menu

- Booking progress text is black in light mode. Shared pale Tailwind foregrounds across app pages/components map to semantic dark ink; muted text is darker on the off-white canvas. Bright blue action fills use a readable dedicated foreground. The fleet's lime action uses its fill token, not the darker light-mode status text token.
- The rental action menu renders into a body portal with fixed positioning above card clipping. It clamps to the viewport, opens upward near the bottom, scrolls when tall, and follows scrolling/resizing. Keyboard navigation, Escape, focus and outside-click dismissal are handled; links navigate without the old parent preventDefault.
- Shared light text/status/to-do palettes pass calculated 4.5:1 contrast checks on standard surfaces. A source audit covers legacy foreground classes throughout all pages and components. This does not certify every live combination or replace browser verification.
- Frontend helpers/tests are consolidated into existing fleet-bookings files; menu positioning remains in RentalActionMenu. The only new frontend component is the shared return form used by three pages, avoiding duplicated form logic.
- Final frontend checks: 38 tests passed; TypeScript and focused ESLint passed. Menu placement boundary checks passed before its unchanged helper was inlined. Workflow lint and diff checks passed. Backend remains 197 passed, 5 Linux-only skipped, one existing warning.
- Local Worker build was attempted with the required development API URL but failed on sandbox EPERM resolving Vite/react-dom. Browser verification was attempted twice; the browser tool failed to start. Complete Worker build, Linux integration tests, return workflow in Odoo, and desktop/mobile visual checks remain pending staging CI/manual verification.

## Post-Block 02 pickup correction

- User verified staging login/deployment, returns and odometer updates on f6dc558.
- Actual handover is required before showing rented/return due. Missed pickups stay reserved and appear separately in Needs attention, with pickup, follow-up and cancellation actions. Past-day pickup is available on rental detail and linked from fleet/calendar. Drafts, returned and cancelled records are excluded from attention.
- Overview reads all open fleet bookings; calendar can request all sales without the ordinary 100-record limit. Default API pagination and authentication/deployment remain unchanged.
- Targeted fleet/return tests: 75 passed. Frontend tests: 40 passed; TypeScript passed. Full backend run stopped after stalling on Windows; rerun in the isolated Docker test project before push.
