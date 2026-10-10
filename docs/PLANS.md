# Client plans and feature layers

| Plan | Included |
| --- | --- |
| Starter | Bookings, prospects, customers, quotations, reservations, calendar, pickup/return, payments, manual to-do, basic vehicle states and return odometer |
| Premium | Starter + Fleet care documents/contracts, maintenance plans, automatic reminders, eligibility enforcement and analytics |
| Enterprise | Premium baseline. Multi-agency organization and employee administration are planned capabilities, not delivered by selecting this label. |

Existing companies default to Premium to preserve behavior. New companies start on Starter. Assign the purchased plan in private administration before issuing credentials. Plan selection resets overrides; individual switches override that plan. No records, uploads or history are deleted on downgrade. Features affect all active company sessions at the next API request. The UI refreshes on focus and every minute. Disabled Fleet care also disables compliance. Disabled reminders stop bell polling and automated Fleet alerts; manual tasks remain usable. Core financial arithmetic and actual mileage recording are never disabled.

Private VPS controls (no public admin endpoint):

```
sudo /opt/klynx-admin/venv/bin/python deploy/admin.py --environment production menu
sudo /opt/klynx-admin/venv/bin/python deploy/admin.py --environment production features kng --plan starter
sudo /opt/klynx-admin/venv/bin/python deploy/admin.py --environment production features kng --plan premium
sudo /opt/klynx-admin/venv/bin/python deploy/admin.py --environment production features kng --off analytics
sudo /opt/klynx-admin/venv/bin/python deploy/admin.py --environment production features kng
```

Menu option 9 shows effective switches. Flags: fleet_care, fleet_compliance, automatic_reminders, analytics. Turning Fleet care back on restores its dependency unless an explicit compliance-off override remains; use --reset to return to plan defaults. Entitlements are stored in a small additive company_features table in the existing private control registry, audited and keyed to company. Odoo remains the source for all business data. Operators cannot change plans through the API.

Starter trusts the agency's manual readiness decision; it does not certify compliance. Downgrading never silently releases vehicles already marked unavailable: an agent reviews and explicitly marks them available through the existing action. Uploaded proof remains stored. An invalid/closed insurance policy does not vanish on downgrade.

Sidebar groups contain Rentals, Fleet and Management modules; only entitled modules appear. There is no extra desktop workspace bar. Mobile retains accessible module navigation. No routes or deployment infrastructure are replaced.

## Visual owner panel

On your VPS, from this repository:

```
sudo /opt/klynx-admin/venv/bin/python deploy/admin_panel.py --environment staging
```

Keep that terminal open. On your own computer open a second terminal and use your existing SSH destination:

```
ssh -N -L 8899:127.0.0.1:8899 longo@YOUR_VPS_IP
```

Open the private localhost launch link printed by the VPS. It contains a temporary key; the panel removes it from the address bar after opening. Client cards show plan, status, switches and dependencies. Changes apply only after Save changes. Stop the VPS panel with Ctrl+C and close the tunnel when finished. Production uses the same command with --environment production. Keep the panel on loopback; no public domain, firewall opening, Cloudflare route, extra service or new customer role is needed.

The visual panel currently manages plans and features. Company provisioning and password/user operations retain the existing private administration tool. Enterprise multi-agency organization and an employee-management UI are follow-up work; the plan name alone does not implement them.
