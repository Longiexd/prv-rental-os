# Klynx Rental OS fix tracker

Updated: 2026-10-04. Starting point: staging commit
`275c02b7744a493a579d840d4b6582eb4b661f15`.

## Block 01 — Fleet availability and actual handover

Implemented and covered by local automated checks:

- Fleet opens in cards view; the list toggle remains available.
- Draft and quotation bookings appear in their own card section and do not
  reserve a vehicle or hide its confirmed booking.
- Confirmed bookings remain Reserved until the existing pickup action records
  actual handover. A picked-up booking becomes Rented; an unreturned booking
  whose return date has passed becomes Return due.
- Cancelled and returned bookings do not drive fleet state or block dates.
- Sync clears stale Reserved, Rented and Return due states when no confirmed
  unreturned booking remains. Cleaning and Maintenance survive automatic sync.
- Availability uses the requested date range rather than rejecting a vehicle
  solely because its stored state is Reserved or Rented. Overdue unreturned
  rentals still block new bookings until the agent resolves them.
- Bulk sync reads vehicles and bookings once and reuses state lookups. Matching
  states are not rewritten.
- Pickup rejects returned/unconfirmed/future bookings, inactive vehicles, and
  vehicles still undergoing cleaning or maintenance. Repeated pickup refreshes
  fleet state without adding another handover marker.
- Booking creation stores supplied pickup/return times. Date edits retain the
  existing times when the caller does not send new times.
- The fleet booking feed includes older open records beyond the regular sales
  list's 100-record limit. `/sales` keeps its default response and limit;
  `/sales?for_fleet=true` opts into the open vehicle-booking feed.
- Shared confirmation policy lives in `app/core/bookings.py`; pure vehicle
  policies live in `app/verticals/car_rental/states.py`. Existing Odoo note links,
  tags, route names and response shapes remain compatible.

Files changed in this block:

| Area | Files |
| --- | --- |
| Core policy | `backend/app/core/__init__.py`, `backend/app/core/bookings.py` |
| Vehicle policy | `backend/app/verticals/__init__.py`, `backend/app/verticals/car_rental/__init__.py`, `backend/app/verticals/car_rental/states.py` |
| Existing routes | `backend/app/routes/calendar.py`, `cars.py`, `booking_changes.py`, `rentals.py`, `sales.py` |
| Fleet UI | `frontend/app/dashboard/fleet/page.tsx`, `frontend/lib/fleet-bookings.ts` |
| Regression checks | `backend/tests/test_fleet_lifecycle.py`, `frontend/lib/fleet-bookings.test.mjs`, `.github/workflows/ci.yml` |
| Tracking | `docs/klynx-fix-tracker.md` |

Validation:

- Python 3.12: **133 backend tests passed** (baseline: 97); one existing Starlette
  TestClient/httpx deprecation warning remains.
- Node 22: **25 tests passed**, covering fleet selection, proxy security and
  Worker environment isolation.
- TypeScript: `npx tsc --noEmit` passed.
- Git: `git diff --check` passed.
- The full `npm run build:vinext` check is **unverified**: Windows sandbox
  permissions rejected Vite dependency `realpath` calls with `EPERM`. No
  dependency versions, lockfile or build configuration were changed to work
  around this environment limitation. CI must confirm the full build.
- Odoo integration, browser rendering and a live lead-to-return workflow have
  **not** been verified. These unit checks mock the Odoo RPC boundary.

## Remaining blocks

| Block | Scope | Status |
| --- | --- | --- |
| 02 | Return one selected booking, return kilometrage, odometer update, return/damage notes, next operational state | Pending |
| 03 | Linked prospect stages after confirmation, handover and return; explicit guided handover UI | Pending |
| 04 | Needs Attention menu clipping, light-theme contrast and unpaid invoice filtering | Pending |
| 05 | Basic printable rental contract and replaceable template with customer, vehicle, dates, payment and mileage fields | Pending |
| 06 | Reusable customer/vehicle document tracking, uploads, verification, expiry and pickup checklist | Pending |
| 07 | Vehicle document/profile improvements, maintenance notes and configurable vidange reminders | Pending |
| 08 | Full staging journey and infrastructure checks, including activities, payment, cancellation, date edits and return | Pending |

## Staging issues that still need live verification

- The last supplied running-container inspection showed the old `ir.model`
  lookup. Native activity defaults and their tests already exist in the starting
  Git commits; deployment of that code is still unconfirmed.
- The invoice payment log reported a missing sender email. Configure the API
  user's **Related Partner email**, keeping its Odoo login unchanged. The
  automated confirmation checks accept both a deposit and full payment; they
  do not prove payment registration works on the live Odoo instance.
- Login recovery is unconfirmed. An Odoo login and the related partner email
  are separate values; changing the email does not require changing the login.
- Earlier infrastructure evidence showed the API could not resolve the legacy
  Odoo container and the generated tenant Odoo returned HTTP 500. The correct
  registered endpoint/network and release attachment need a dedicated review.
- The existing return route can tag multiple eligible orders for one vehicle.
  Block 02 must select a single booking before this workflow is considered
  fully verified.

Apply and validate one block at a time. A local commit, passing unit tests or a
ZIP package does not establish that the VPS release or Cloudflare Worker has
been updated. Confirm the deployed release and perform the staging journey
before declaring a block operationally verified.
