# Vehicle eligibility for rental

Klynx uses the vehicle and private evidence in that company's Odoo database.
Renewal reminders, compliance and operational state are separate checks. A valid
policy nearing renewal is a warning; invalid required evidence blocks a rental.

| Evidence | Required check before confirmation / pickup |
| --- | --- |
| Insurance | Verified scan, current coverage, expiry through planned return, payment/active coverage checked |
| Registration (carte grise) | Verified scan; honour an expiry date if entered |
| Technical inspection (visite technique) | Verified certificate with validity through planned return |
| Circulation tax (vignette) | Verified receipt, applicable validity through planned return, payment checked |
| Rental operating card (carte d'exploitation) | Verified evidence; honour start/expiry dates if applicable |
| Lease / service contract | Optional; reminders do not determine legal eligibility |
| Oil change | A scheduled reminder; an actual Maintenance state still blocks rental |

These are Klynx's evidence requirements. A staff member checks the scan and records
its validity and payment/active coverage. The app does not query an insurer, ATTT
or tax authority and cannot independently establish that money was paid.
Unconfirmed evidence is labelled unconfirmed, not unpaid. Registration and
operating cards are not assigned an invented expiry date.

## Existing fleet and state changes

After installing, add vignette and operating-card evidence and review existing
insurance payment/coverage. Older records without the new confirmation flag stay
unconfirmed. Nothing is automatically marked paid or verified. Uploading a new scan
keeps older versions but requires verifying the replacement.

- A vehicle lacking valid required evidence moves to the native Odoo Indisponible
  stage during sync, or immediately after saving its evidence.
- Cleaning, Maintenance and a real collected rental retain their operational states.
  Compliance is displayed alongside them and still blocks a new confirmation/pickup.
- Completing a renewal does not release a manual hold. Mark the vehicle ready after
  reviewing it; a future reservation remains Reserved rather than being lost.
- Evidence must be valid today and through the proposed return, including an
  extension. Expiry day is inclusive. Drafts remain editable and nonblocking.
- Returns to Cleaning or Maintenance still record the actual mileage, even when
  documents have expired. Choosing Available also requires valid evidence.
- Linked Odoo insurance cancellation blocks coverage. Native coverage-date edits
  require reviewing the saved scan again. Unrelated manual contracts are not overwritten.

The app refreshes/syncs while open, on focus and after Fleet document/service/return
changes. Confirmation and pickup independently recheck the backend, including when
no dashboard is open. There is no newly installed cron service; the native stage
is refreshed on the next sync after an overnight expiry.

## Storage and migration

Scans, validity and verification/payment flags remain private Odoo ir.attachment
records on fleet.vehicle, using the existing metadata convention. Insurance/lease/
service agreements use linked fleet.vehicle.log.contract records. Oil-change plans
and completion history use fleet.vehicle.log.services; real returns update Odoo's
vehicle odometer and its history. No second fleet database or new infrastructure.

## Tunisian source review — 10 October 2026

- [CGA compulsory insurance guidance](https://www.cga.gov.tn/index.php?L=0%27%27&id=102)
  describes mandatory motor civil liability; the [official insurance code](https://www.cga.gov.tn/fileadmin/contenus/pdf/Code_Assurance_Version_FR.pdf)
  describes evidence of cover. A scan/payment flag is our agency control, not an
  insurer's live certification.
- [Ministry of Transport regulations](https://www.transport.tn/fr/terrestre/reglement)
  list the car-rental cahier des charges (5 February 2002), road-vehicle documents,
  operating-card rules and technical inspection legislation. The Ministry also
  publishes the [rental operating-card application](https://www.transport.tn/fr/imprimer).
  Use the validity on the issued inspection certificate instead of applying the
  ordinary private-car inspection schedule to a rental fleet.
- [Ministry of Finance published tax compilation](https://www.finances.gov.tn/sites/default/files/RECUEIL%20DES%20TEXTES%20RELATIFS%20AUX%20DROITS%20ET%20TAXES%20NON%20INCORPORES%20DANS%20LES%20CODES%20FISCAUX%202017.pdf)
  contains rental-specific circulation-tax deadlines. This is a 2017 compilation,
  not certification of all 2026 amendments. We therefore use the agency's checked
  applicable validity date rather than hardcoding 31 December or the generic
  company-car deadline.

This change implements vehicle evidence controls. It does not certify compliance
with every agency licensing, vehicle-age, tax, contract or reporting obligation.
