# Klynx OS changes

## 1.0.0-rc.2 — pending staging validation

- Check required vehicle evidence through planned return before booking confirmation and pickup.
- Track vignette and operating-card evidence and payment/active coverage confirmation in Odoo.
- Use native Indisponible for compliance blocks; preserve cleaning, maintenance and actual rental states.
- Keep return mileage and Fleet reminders connected; explain blocked vehicles without mixing customer to-dos.
- Separate Rentals, Fleet and Management navigation while retaining existing routes and records.
- Strengthen light-mode text, card borders/shadows, selected controls and semantic status colours.

Review [fleet evidence requirements](docs/FLEET_ELIGIBILITY.md) before rollout.
Existing vehicles need the newly required evidence reviewed. This remains a release
candidate until the staging deployment and real agency journeys are validated.

## 1.0.0-rc.1 — pending staging validation

- Keep upcoming insurance renewals visible alongside missing or unverified scans.
- Explain vehicle alert badges in the vehicle details and link to the relevant Fleet care record.
- Connect Fleet care to existing Odoo vehicle states, native contracts and service history.
- Save oil-change plans as Odoo services; record actual mileage only when completing service.
- Keep existing private scans and old maintenance plans readable; link older contracts explicitly.
- Run tenant isolation under PR CI and keep it as a staging deployment gate.

This is a release candidate, not an official LTS release. Existing login, rental,
deployment and tenant provisioning behavior is retained.
