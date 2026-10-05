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
| Fleet cards, draft visibility and availability lifecycle | User verified on f6dc558; late-pickup correction prepared separately |
| Booking-specific return, mileage, notes and operational state | User verified working on f6dc558, including odometer updates |
| Unpaid invoice filtering | Pending |
| Booking-to-prospect stages and explicit handover | Pending |
| Contract template/action | Basic printable contract implemented; Linux build/live verification pending |
| Customer and vehicle document tracking | Private native Odoo uploads/checklist implemented; Linux HTTP/live verification pending |
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

## Block 03: contracts and private documents

- Base is the user-verified staging commit f6dc558. Separate missed-pickup correction precedes this feature commit. Authentication, credentials, private proxy, dependencies and deployment workflows are unchanged.
- One reusable document workflow uses native private ir.attachment records scoped by parent model and ID. Customer CIN/driving licence and vehicle assurance/carte grise/visite technique are supported. PDF/PNG/JPEG files up to 600 KiB fit the existing JSON proxy limit; no public links or new upload infrastructure.
- Statuses are missing, uploaded, verified and expired. Upload and replacement reset verification. Expired documents cannot be marked verified. Latest scans are shown; older scans remain in Odoo. Corrupt metadata fails closed instead of falling back to an earlier verified scan. No deletions or production data migrations.
- One shared DocumentsPanel appears on customer detail, rental detail before pickup, and fleet vehicle detail. Readiness requires both customer documents verified and unexpired. It is guidance, not a new hard pickup gate. File download/review is authenticated; upload errors do not block booking/payment screens.
- Generate / Print rental contract returns a replaceable basic French template populated from customer/vehicle details, document numbers, planned dates, totals, paid amount, balance and currency/agency. The browser prints or saves PDF. All values are escaped, with no external resources or scripts. Cancelled/incomplete bookings are rejected. Generating a contract does not confirm, invoice or collect a booking.
- Actual handover now snapshots valid odometer/unit into the existing booking note, once. Contracts use that historical reading and completed return mileage; legacy pickup mileage stays blank when it was never saved. Failed pickup writes cannot report success.
- Local verification: 149 backend tests passed across the selected business/lifecycle suites and pure document/contract tests. 40 frontend/security/Worker tests, TypeScript and focused document-component ESLint passed. Full Linux backend tests remain required: local Windows socket creation hung in HTTP and probe tests (confirmed by faulthandler). Full Vinext build was attempted but hit the existing sandbox EPERM resolving Vite dependencies. No live Odoo uploads/printing or browser interaction has been verified by the agent.
- CRM custom CIN/Permis and pickup/drop-off properties still require technical names/types before mapping; existing CRM fields remain untouched. Booking-to-prospect stage sync remains a separate pending update. Odoo 18 defines lead_properties using the sales-team definition; labels in a screenshot are not stable field identifiers.
- Configurable company/vehicle vidange interval and km reminders remain the next maintenance block, as requested.

## Block 03 follow-up: guided paperwork and agency templates

- Continue from the existing Block 03 changes. The user explicitly excluded CRM opportunity pickup/drop-off field synchronization from this update. Authentication, credentials, registry, proxy, deployment and dependency versions are unchanged.
- Remove the fixed 30% condition. Any positive net posted payment enables explicit agent booking confirmation; refunds reduce that amount. Payment does not automatically confirm a booking or hand over a vehicle.
- Add Documents & contract between confirmation and actual pickup. Missing paperwork is linked from the progress bar and today's attention list. Pickup requires a verified, unexpired CIN or passport with its number, a verified driving licence with its number, and a current saved contract acknowledged as printed/saved by the agent. Backend checks enforce the same conditions; legacy already-collected retries remain idempotent.
- Read uploaded bytes back through the authenticated Odoo session before reporting success. Disable binary size responses and image postprocessing; if a filestore write was acknowledged but cannot be read, keep a bounded private native database copy and verify it. Lost historical bytes cannot be reconstructed: reupload those scans and check the filestore if the problem repeats.
- Customer originals are reusable. Preparing the contract saves immutable private copies on the rental and saves the printable HTML. Preparation/confirmation/pickup check ownership and hashes. Failed note-link writes reuse readable artifacts on retry; missing or changed files can be regenerated. Booking, location, customer, document or payment changes before pickup require a fresh contract. Copies and saved contracts remain available after return.
- Template setup is in the existing rental paperwork panel: Company contract template. Choose the basic French/Arabic form, or upload a blank straight A4 portrait PNG/JPEG scan or Canva export, place each field and enter company conditions. Native private attachments on the Odoo company contact hold versioned templates. No OCR, public document service, new schema, or new production files are introduced. Physical printing is an agent acknowledgment; browsers cannot prove a printer produced a page.
- New/edit booking forms expose the existing API's pickup/return times and bounded locations. Location suggestions/defaults use native Odoo Fleet vehicle.location. Planned pickup/return places remain on the Odoo order note; actual return updates native vehicle.location alongside mileage. Future booking edits do not move a vehicle, and completed return retries preserve later manual location/state changes. Existing datetime and conservative day-based availability conventions are retained.
- Local verification: 153 targeted backend business/document/lifecycle tests passed; 12 HTTP tests were deselected because the complete Windows TestClient run previously stalled in socket creation. All 40 frontend/security/Worker tests and TypeScript passed. Full DocumentsPanel lint passed; focused existing-page lint passed with the pre-existing set-state-in-effect rule excluded. Git diff checks passed. Full Vinext build hit Windows sandbox EPERM resolving dependencies; browser preview timed out. Full Linux Compose tests/build and live Odoo storage, templates, printing, pickup and return verification remain required before release.
- Vidange reminders and unpaid invoice filtering remain separate pending blocks.

## Contact identity follow-up and conversation checklist

- Customer identity now shows a CIN / passport selector and one identity form, plus the driving licence. Switching forms preserves saved files; either verified identity is sufficient. If both are already verified, the existing contract policy uses CIN first.
- Nationality is next to the identity number; birth date is optional. Both are saved in private document metadata on the native Odoo contact attachment, returned in its checklist and used as defaults for future contracts for that same contact. No duplicate contact is created and no CRM opportunity properties are changed.
- Older API callers retain these optional fields when omitted. Future birth dates and oversized nationality values are rejected. Contract-specific overrides remain on the rental; they do not overwrite reusable contact data. Editing contact identity data invalidates an uncollected rental's current contract while retaining the saved historical copy.
- Optional identity OCR is not implemented. No identity extraction engine is configured in this repository. A future opt-in reader must suggest editable values for agent review and must never automatically verify the document. Upload/storage works independently of extraction.
- Local checks: 158 targeted backend tests passed (12 HTTP tests deselected for the previously diagnosed Windows socket limitation); 40 frontend/security/Worker tests, TypeScript, document-panel ESLint and diff checks passed. Full Linux tests/build and live browser verification remain pending. This patch changes six existing files, adds no production files/dependencies and does not change authentication or deployment.

Implemented in this conversation (live verification varies by block):

- [x] Preserve the verified authentication/deployment baseline and repair registered Odoo connectivity during deployment/rollback.
- [x] Remove redundant staging CI pushes and cancel superseded PR checks; retain independent PR and deployment validation.
- [x] Fleet cards by default; show quotations without blocking availability; confirmed booking lifecycle; preserve manual cleaning/maintenance states.
- [x] Separate missed pickup from rented/return due; explicit handover and overdue pickup attention/actions.
- [x] Booking-specific return mileage, return/damage notes and chosen next state; update native Odoo odometer; retry protection.
- [x] Improve light-mode text contrast and render attention menus above clipping containers.
- [x] Private customer/vehicle document upload, review/download, verification and expiry tracking on Odoo attachments; verify readable persistence.
- [x] CIN or passport plus driving licence; reusable contact identity data; immutable per-rental document copies.
- [x] Basic printable bilingual contract, company scan/Canva template placement and terms; saved per-rental contracts.
- [x] Payment or partial payment enables explicit confirmation; replace fixed 30% progress stage with paperwork; require validated documents and a current contract acknowledged as printed/saved before actual pickup.
- [x] Pickup/return times and locations; suggestions from native Fleet Location; actual return updates Fleet Location.
- [x] Correct the write-failure test to provide a valid required document number (VPS commit 5d8c21e).

Remaining:

- [ ] Apply this contact identity follow-up, run full Linux backend/build checks, then verify the new selector and a repeat-client contract in staging.
- [ ] Complete live verification of upload/review, agency templates, stale-contract regeneration, pickup gates and archived rental copies; latest CI/deploy results are not yet confirmed by the agent.
- [ ] Opt-in identity OCR with editable suggestions and explicit agent verification.
- [ ] Configurable company/vehicle vidange interval, last-service km and approaching/overdue reminders.
- [ ] Unpaid invoice filtering.
- [ ] Booking-to-prospect stage synchronization: reservation confirmed, vehicle handed over, rental completed.
- [ ] Focused dependency vulnerability assessment/remediation and measured deployment performance review.

Opportunity pickup/drop-off synchronization was explicitly excluded by the user; it is not a remaining requirement for this block. No automated deployment, authentication or dependency changes are included in this follow-up.

## Compact paperwork, linked follow-ups and expiry reminder dates

- Identity uses one expandable CIN / Passport row and one number field, with the type selector inside. Licence and other documents also collapse to status rows. Missing/expired rows remain visibly red; uploaded files show Needs review; verified rows remain green. Existing files are preserved when switching identity types.
- Storage guidance is visible in the panel: private customer originals belong to the Odoo contact, rental archives belong to the booking, and vehicle files belong to the native Fleet record. Nationality and birth date from the preceding follow-up remain reusable.
- Paperwork and its load error are after Invoices & payments. The prospect link is a bordered semantic button using the existing readable to-do palette in both themes.
- Rental To do uses the existing compact component, lists upcoming as well as due scoped follow-ups, and creates new activities against the linked CRM prospect. Earlier booking activities are read alongside them; rentals without a prospect retain booking-bound scheduling. All actions keep native mail.activity and existing authorization. Compact lists can expand beyond five items without navigating to unrelated global activities.
- Vehicle uploads/updates store expiry and a reminder_date one calendar month earlier, clamping month-end/leap-year days. Removing expiry clears its reminder date. Existing documents derive the same reminder from stored expiry without migration. The renewal window date is shown on the vehicle form. This is the foundation requested for later reminders; there is no background notification sender or new scheduler in this patch.
- Verification: 164 targeted backend tests passed (12 HTTP tests deselected for the existing Windows socket limitation); 40 frontend/security/Worker tests and TypeScript passed. Component lint passed; the rental page passed focused lint with its pre-existing set-state-in-effect rule excluded. A mocked component interaction check verified prospect and legacy booking loads, prospect activity creation, booking-only fallback and two collapsed identity/licence rows. Full Linux tests/build and live visual checks remain required.
- No new production files, dependency upgrades, authentication, registry, proxy or deployment changes. Only existing document, activity, rental page, regression test and tracker files change.

## Fleet modal document fold

- The Fleet vehicle detail modal now has a collapsed Vehicle documents section containing the shared collapsed assurance/carte grise/visite technique rows. Expand the section, then the relevant document to review or edit it. Opening another vehicle resets the outer fold; its private attachments stay scoped to that vehicle ID.
- The same compact-paperwork ZIP is refreshed in place and includes this small third patch. Its installer skips any preceding patches already applied by comparing file trees.
- VPS replacement and post-push cleanup are documented in the bundle README. Cleanup targets only the named temporary bundle folders/archives and the isolated test project; repository, deployed release and Odoo storage remain intact.


## Unified document review, additional driver and reference-based extras

- Merge customer originals and immutable rental copies into the same two collapsed identity/licence rows. One colored Download / review button is enabled only for an uploaded scan. Before handover, choose current document or the copy preserved with this rental within that row; after handover the review uses the saved rental copy. Save uses the existing lime status tokens and review uses the pink tokens, with the existing light/dark contrast checks.
- Add one optional additional driver with name, phone, address, licence issue date, and the same CIN-or-passport/licence upload, nationality, birth-date, verification and expiry workflow. Driver PII and scans are private native Odoo attachments on this rental, not a new CRM contact or booking field. Contract template fields include the driver's full details. Uploads and verification are separate, and changing the driver's name requires their own fresh scans.
- Adding/changing/removing a driver invalidates a prepared contract as appropriate. Preparation and actual pickup require both people's verified identity/licence if a driver is active. The printed contract retains independent immutable document copies for both people; previous versions are preserved. Driver forms/scans are editable before handover only, preserving the existing collected/returned contract workflow.
- Show fee guidance when an active additional driver lacks OPT-CDSUPP on the quotation or the fee has not yet been invoiced. Open the existing booking editor to add the service or acknowledge that no fee applies. Nothing adds charges or rewrites posted invoices automatically.
- All active saleable OPT-reference products appear in extras without requiring Odoo optional-product links. DEP references stay deposits and LOC references stay rental products. The pink Matches this vehicle type group retains LOC-ECO and DEP-ECO for Economy (and the corresponding references for other categories); OPT products are kept separate. Existing selected items are excluded. The native optional-template lookup is no longer needed, reducing one Odoo request on rental option loads.
- Validation: 224 backend tests passed, 5 platform tests skipped, 12 document HTTP tests deselected; the Windows-only socket stall also prevents the tenancy/calendar HTTP suites from completing locally. 41 frontend/security/Worker tests passed, including separate Economy LOC/DEP and OPT rules. TypeScript passed; DocumentsPanel lint passed, with existing modal/page set-state-in-effect findings excluded from focused lint. Mocked component event checks cover the merged panel, disabled review on missing scans, saved-copy download, rental-only additional-driver save and fee reminder. Full Linux tests/build and live Odoo/browser checks remain required.
- Existing files only. Authentication, credentials, registry, proxy, deployment workflows and dependency versions remain unchanged. The same ZIP includes this fourth patch and skips earlier patches already applied.
