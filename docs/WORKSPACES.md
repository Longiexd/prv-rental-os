# Three workspaces, one connected app

| Workspace | Existing pages |
| --- | --- |
| Rentals / Locations | Daily overview, rentals, calendar, customers, prospects and customer to-dos |
| Fleet / Parc automobile | Vehicle availability and Fleet care: evidence, renewals, servicing and mileage |
| Management / Direction | Existing analytics: revenue, collections, demand and utilisation |

The selector changes navigation and keeps the existing URLs and records. Deep
links select the right workspace, including legacy CRM routes. Mobile navigation
uses the same grouping. This is organisation of the existing app, not new roles
or permissions. Owners can move between all three.

Rentals retains booking/customer quick actions and its customer notification bell.
It shows only a compact link when vehicles are blocked by required evidence. Detailed
Fleet reminders move to Fleet, where the summary and vehicle details explain each
alert and link to the relevant record. Existing user menu/logout and theme/language
controls stay shared.

A return writes actual mileage to Odoo through the existing return workflow, then
refreshes Fleet reminders. Management reads the same records and excludes legally
blocked vehicles from its available count. No duplicate entry, separate fleet store,
or invented cost/performance metrics are introduced.
