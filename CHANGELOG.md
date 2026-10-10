# Klynx OS changes

## 1.0.0-rc.1 — pending staging validation

- Keep upcoming insurance renewals visible alongside missing or unverified scans.
- Explain vehicle alert badges in the vehicle details and link to the relevant Fleet care record.
- Connect Fleet care to existing Odoo vehicle states, native contracts and service history.
- Save oil-change plans as Odoo services; record actual mileage only when completing service.
- Keep existing private scans and old maintenance plans readable; link older contracts explicitly.
- Run tenant isolation under PR CI and keep it as a staging deployment gate.

This is a release candidate, not an official LTS release. Existing login, rental,
deployment and tenant provisioning behavior is retained.
