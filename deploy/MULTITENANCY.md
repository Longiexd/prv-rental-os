# Klynx administration and company isolation

## Decision

One public Rental OS application, one API per environment, and one Docker Compose Odoo/PostgreSQL stack per company. Only Klynx administers companies, user accounts and passwords. There is no customer signup, user-management endpoint, or customer platform administrator.

The private administration menu runs over the existing SSH/Tailscale connection on the VPS. It does not add a public administration service or give the API access to Docker. Select **Add company**, then **Add user** for each worker. Give the worker a username such as `atlas.sarah` and their password. Another company can have `bravo.sarah`; these are separate accounts.

Shared Odoo with separate databases would save memory, but would also share the Odoo process, module upgrades, database-management surface and failure domain. Dedicated Compose projects fit the current deployment model and provide a clearer boundary. This costs approximately one Odoo/PostgreSQL pair per company. The configured memory ceilings are 1 GiB and 512 MiB respectively, not measured usage or a capacity guarantee. Measure the VPS before adding companies; never oversubscribe based only on idle usage. A shared VPS and the central API remain common failure/trust boundaries. Containers are not separate physical machines.

## Current infrastructure and what changes

Implementation base: staging `d732971f170bf61305a6f8f8d823df199b3b88cb`. Main was `52b358a619e0d27dcb2fd1cb53d69cb264766aeb`. The existing frontend is Next.js source built with vinext into separate Cloudflare Workers. Existing backend Compose projects keep their stable staging/production names and loopback ports 8001/8000. Nginx and the Cloudflare tunnel remain the ingress path.

The previous frontend accepted a fixed demo cookie; the backend used one global Odoo database and service password. This release replaces both. Each login authenticates against exactly one registered company's Odoo database. Passwords are passed to Odoo once and are not retained by Klynx. The browser receives a random, host-only, HttpOnly, Secure session cookie. The API stores only a hash of that token and an encrypted Odoo session. All business routes require that session. Odoo checks the actual worker's permissions.

Browser requests now use `/api/backend` on the application's own origin. The Worker adds its environment-specific secret when calling FastAPI. Exact Origin checks protect mutations; staging cannot submit production mutations. Caller-supplied database names, Odoo URLs, UIDs and tenant headers do not select a company. Documents are downloaded through authenticated routes. The browser never receives an Odoo session or internal URL.

A small SQLite WAL registry stores company routing, registered users, encrypted sessions, request limits and an audit trail. It is local persistent storage, separate for staging and production. This keeps the first single-VPS deployment small. It must not be placed on a shared network filesystem. Multiple API hosts would require a shared control database, distributed limits and coordinated provisioning before scaling out.

## First rollout — staging first

Keep the application behind the existing access gate during this authentication migration. Do not merge to staging until this bootstrap is ready: staging pushes deploy automatically. Do not enable production until the staging checks below pass.

1. Preserve the current staging database and filestore. Existing demo Compose projects are not deleted, renamed, imported or upgraded by this tool. Create fresh isolated test companies for this release. Back up the previous environment files privately; remove obsolete global Odoo credentials from the new runtime configuration. Rotate credentials previously included in backend image layers by the old release installer.
2. On the VPS, install this reviewed checkout under a root-controlled release directory. Create the host Python environment used by the private tool:

   ```bash
   python3 -m venv /opt/klynx-admin/venv
   /opt/klynx-admin/venv/bin/pip install -r backend/requirements.txt
   ```

3. Pull the reviewed Odoo 18 and PostgreSQL 15 images. Record the exact digests used in the successful integration check. Bootstrap each environment with those immutable digests, not moving tags:

   ```bash
   sudo /opt/klynx-admin/venv/bin/python deploy/admin.py --environment staging init \
     --odoo-image 'odoo@sha256:<reviewed-digest>' \
     --postgres-image 'postgres@sha256:<reviewed-digest>'
   ```

   Initialization creates `/var/lib/klynx/staging/control` and `/etc/klynx/staging`. Keys are generated locally and never printed. Repeat with `production` only when preparing that environment. Never copy staging keys, registry files or tenant data into production.

4. Install `/etc/klynx/<environment>/proxy.key` as the **KLYNX_PROXY_KEY** secret on that environment's existing Worker through Cloudflare's secret mechanism. Use a secure input stream or dashboard; never commit it, put it in `NEXT_PUBLIC_*`, include it in a build argument, or paste it in this document. Where API ingress uses Cloudflare Access, provision a service token limited to the matching API hostname and set **CF_ACCESS_CLIENT_ID** and **CF_ACCESS_CLIENT_SECRET** as Worker secrets. No browser bypass of Access is needed. Keep `APP_ENV`, domain bindings and `NEXT_PUBLIC_API_URL` as configured in `frontend/wrangler.jsonc`.
5. Replace the GitHub environment's `BACKEND_ENV` with the matching `backend/.env.staging.example` or `.env.production.example` values. These now contain paths and origins, not Odoo credentials. Compose fixes the environment and mount paths. Runtime env files live in `release/runtime`, outside the backend Docker build context. The backend `.dockerignore` also excludes secrets.
6. Install the reviewed `deploy/install-release.sh` as the existing root-owned `/usr/local/sbin/klynx-install-release`. Preserve the previous restricted sudo/SSH arrangement. The installer requires an initialized control store; it reattaches the recreated API container to active company networks and checks Odoo reachability plus `/ready`. It refuses an automatic rollback to the old unauthenticated backend.
7. Open the private menu from that checkout:

   ```bash
   sudo /opt/klynx-admin/venv/bin/python deploy/admin.py --environment staging menu
   ```

   Add two test companies, then the same local worker login to both with different passwords. Company creation asks for the legal/company name, ISO country, currency and Odoo accounting-template code. Klynx must choose the correct local accounting template. These are business configuration choices, not safe defaults to infer from a login or server location.
8. Merge the reviewed feature into staging. The workflow runs the real Compose integration check, backend tests, frontend type checks/build and Worker isolation checks before deploying. Worker secrets must already exist. Validate login, logout, reload, worker disable/reset, PDF downloads, customer creation, a rental, quotation confirmation, invoice creation and payment in the staging UI. Verify rejected access across both companies and from the production origin. Check Odoo role coverage against these actual business journeys.
9. Enable `PRODUCTION_DEPLOY_READY=true` only after staging acceptance and production bootstrap. Merge staging into main using a merge commit or fast-forward. A main push automatically promotes only a commit with a successful staging deployment and the same tree as main. Environment reviewer rules still apply if configured in GitHub. Production rebuilds with production-specific Worker configuration; it does not reuse staging data or secrets.

## Daily onboarding

- **Add company** creates a stable Compose project, a separate PostgreSQL volume/database and least-privileged runtime DB role, an Odoo filestore, private application/database networks, strong generated infrastructure secrets, exact database filtering, no public database listing, and the required business modules. Neither Odoo nor PostgreSQL publishes host ports. The API joins the company's application network; it does not join the database network.
- **Add user** creates a real Odoo internal worker with fleet, sales and invoice business permissions, registers its UID, and activates login only after completion. It grants neither Odoo Settings nor user-administration groups. There is deliberately no client-admin role.
- **Reset password**, **Disable user**, **Enable user** and **Suspend company** are Klynx-only operations. Reset/disable first remove Klynx access and existing sessions, before contacting Odoo. A failure leaves access disabled. Passwords are entered without terminal echo, or generated for one-time display to Klynx. Keep terminal recordings and shell tracing off when issuing credentials.
- Company provisioning failures preserve files and volumes and leave the company unavailable. Retry with `admin.py --environment staging resume-company <code>`. This only accepts incomplete companies; it never reinitializes an active company. Interrupted user creation can be repeated from Add user. Do not delete volumes to resolve a provisioning error.
- A fresh company has no customer business data. Load its fleet and rental products, verify the chart of accounts/journals/taxes and document settings, and complete a sample rental before handing over credentials. Outbound email is not enabled by default: private company networks block external egress. Any SMTP/relay access and sender configuration must be set up by Klynx explicitly.

## Operational limits and recovery

- Sessions last at most eight hours and expire after 30 minutes idle. Odoo validates its session on each authenticated request. Sessions are encrypted at rest, while their browser tokens are stored only as hashes. Eight concurrent API requests per company and 600 requests/minute bound load; login has global, IP and username limits. Limits are conservative starting points; test against the measured VPS workload.
- The API still has trusted access to all company application networks and session keys. A compromised API or VPS administrator is not contained by database separation. Keep host patches, SSH/Tailscale access and Cloudflare account protection in place. No public Docker socket, PostgreSQL port, Odoo web port or user-management API is added.
- Back up each company's PostgreSQL database **and** its matching Odoo filestore together. Pause that company's Odoo during a consistent backup. Keep a SQLite online backup of the control registry, the two environment keys, company Compose/config files and image policy in an encrypted off-host backup with restricted access. Copying only a live SQLite main file can miss its WAL. Do not expose backup files through the web server.
- Before accepting real clients, test a restore into a new isolated staging project. Restore database and filestore together, use new staging credentials, revoke imported sessions, and verify record access and documents before activation. Backup scheduling and an actual restore drill are host operational tasks; this change does not claim they have already run.
- The first authentication migration is a coordinated frontend/backend rollout, not a zero-downtime compatibility release. Keep traffic gated until both halves are verified. Subsequent compatible releases use the existing stable Compose service names. After this migration, rollback only to a tested tenant-aware release; never restore the old demo-cookie/unprotected API combination.

## Verification

### Local development

The root `docker-compose.yml` is for a separate Linux/WSL development environment and keeps frontend port 3100/API port 8000 bound to loopback. Use the same host administration setup with `--environment development`; it creates its own registry, keys and company stacks. It never joins the old shared `odoo-docker_odoo-net`. Create a private, ignored `runtime/frontend.env` containing `KLYNX_PROXY_KEY` with the generated **development** key. Start Compose, then run `admin.py --environment development attach-api`. Do not use this Compose file on the staging/production host; its local API port overlaps production by design.

For a frontend outside Docker, use `frontend/.env.example` with `npm run dev:vinext` on port 3001 and the matching local API/key. Development permits only explicit loopback origins (or the root Compose's `backend:8000` service); production and staging still require their exact configured HTTPS URLs. Local browser tests should use localhost's secure-cookie support. Backend unit tests generate disposable registries and keys automatically.

### Checks

Local checks: `python -m pytest -q backend`, `node --test frontend/lib/proxy-security.test.mjs deploy/verify-worker.test.mjs`, frontend `npx tsc --noEmit`, and `npm run build:vinext` with the target Cloudflare environment. After the build, `python deploy/test_frontend_proxy.py` exercises the actual frontend handlers against a disposable local API double, including secure cookies, CSRF, proxy routing and logout. The separate integration workflow provisions two real Odoo/PostgreSQL stacks on a disposable Linux runner and exercises login, separate customer data, business-role reads, logout and concurrent request latency. Its cleanup is explicitly restricted to that ephemeral CI host; the administrator tool has no delete-company operation.

The production VPS, Cloudflare secrets, GitHub protection rules, real documents and full business flow still require staging validation. Unit tests cannot establish real Odoo module permissions, accounting correctness, capacity or deployment readiness.
