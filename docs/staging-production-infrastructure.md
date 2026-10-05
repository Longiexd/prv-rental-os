# Staging and production infrastructure

The tenant migration extends the existing separate staging/production infrastructure. Follow [the migration and onboarding runbook](../deploy/MULTITENANCY.md) for the required first rollout and Klynx-only administration.

| Concern | Staging | Production |
| --- | --- | --- |
| Branch | `staging` | protected `main` |
| Frontend | `staging.rental-os.klynx.net` | `rental-os.klynx.net` |
| API ingress | `api-staging.rental-os.klynx.net` | `api.rental-os.klynx.net` |
| Cloudflare Worker | `prv-rental-os-staging` | `prv-rental-os` |
| Wrangler environment | `staging` | `production` |
| API port | loopback `8001` | loopback `8000` |
| API Compose project | `klynx-rental-os-staging` | `klynx-rental-os-production` |
| Control registry | `/var/lib/klynx/staging/control` | `/var/lib/klynx/production/control` |
| Runtime keys | `/etc/klynx/staging` | `/etc/klynx/production` |
| Company infrastructure | separate Compose stack per company | separate Compose stack per company |
| Deployment trigger | push after integration checks | main push promoting a successfully staged tree |

## Daily release flow

1. Develop on a feature branch and open a PR to staging. Require the backend, frontend and Tenant integration checks.
2. Merge to staging. The workflow tests two temporary Odoo/PostgreSQL stacks, runs API tests, builds the staging frontend and checks Worker bindings before deploying.
3. Exercise the customer journeys behind Cloudflare Access, including company isolation and credentials revoked by Klynx.
4. Merge staging into main using a merge commit or fast-forward, preserving the staged commit. Do not squash or rebase the promotion. Main's tree must equal the staged candidate's tree.
5. Main's push automatically starts promotion. GitHub verifies a successful staging deployment, rebuilds with production configuration and deploys the same source commit. Existing GitHub environment reviewer rules still apply. `PRODUCTION_DEPLOY_READY` must be `true` after the one-time bootstrap.

There are no manual environment-specific source edits or data copies during promotion. Odoo image upgrades are a separate tested change; onboarding uses the host's stored immutable image digests.

## GitHub configuration

Keep separate `staging` and `production` GitHub Environments. Each has `NEXT_PUBLIC_API_URL`, `CLOUDFLARE_ACCOUNT_ID`, `VPS_SSH_HOST`, `VPS_SSH_PORT` and `VPS_SSH_USER` variables, with the matching URLs above. Production also uses `PRODUCTION_DEPLOY_READY`.

Existing environment secrets are `CLOUDFLARE_API_TOKEN`, `VPS_SSH_PRIVATE_KEY`, `VPS_SSH_KNOWN_HOSTS`, `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, and `BACKEND_ENV`. Scope the Cloudflare token and Tailscale CI identity to the required application and deployment host. Never use a global Cloudflare API key.

Use the corresponding `backend/.env.<environment>.example` for `BACKEND_ENV`. Global Odoo database/user/password variables have been removed. Generated company credentials and control keys remain on the VPS. The release installer writes the runtime env outside the Docker build context. Images exclude `.env` and key files.

Protect main with required PRs, current checks and no force pushes or deletion. GitHub reviewer requirements are an account choice; they are not changed by this repository. If reviewers are required, approving that deployment remains a step even though main pushes trigger promotion automatically.

## VPS and ingress

Preserve Docker Engine/Compose, Nginx, cloudflared and the restricted deploy user. The root-owned `/usr/local/sbin/klynx-install-release` remains the sudo deployment entry point. Install the updated reviewed version once, following the tenant runbook. Its preflight requires the environment's initialized registry, secret files and `/opt/klynx-admin/venv`.

Nginx and the tunnel continue to forward the two API hostnames to their separate loopback ports. Neither tenant Odoo nor PostgreSQL publishes ports. Each tenant has a private database network and application network; only its matching environment's API joins the application network. The API has no Docker socket or tenant database credentials. Existing demo stacks remain intact during migration.

Staging browser access stays behind Cloudflare Access. Browser API requests now go to `/api/backend` on the frontend origin. The Worker forwards them server-side with its private `KLYNX_PROXY_KEY` secret. If API ingress uses Access, give the Worker a matching API-only service token through `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`. The previous cross-origin browser cookie/OPTIONS arrangement is no longer needed. Do not add a public Access bypass.

The staging and production Worker secrets must be different. Worker custom domains, disabled workers.dev/preview URLs, exact Origin checks and host-only session cookies keep the environments separated.

## Release recovery

The installer checks `/ready`, restores tenant network attachments after an API recreation, and verifies active Odoo reachability. A failed release attempts to start the previous tenant-aware backend. The first authentication rollout must remain gated until both frontend and backend are validated because the old demo-auth frontend is incompatible.

Attachment reads the active registry endpoint/database instead of guessing a
container from the company code. Generated stacks use their company application
network; an explicitly registered pre-migration `klynx-odoo-<environment>` stack
uses that environment's legacy network. Other hosts, cross-environment routes,
credential-bearing URLs and database networks are not accepted by this helper.
The health probe reports safe HTTP/network failures and retries bounded cold
starts. A failed release restores the previous backend using the candidate's
attachment helper, so old routing code cannot break recovery again.

After applying a reviewed installer change on the VPS, update the host copy
before pushing the deployment commit:

```bash
sudo install -m 0755 deploy/install-release.sh /usr/local/sbin/klynx-install-release
```

Run this from the checkout containing the repair. This installs the deployment
entry point; it does not itself deploy or restart an application. A green
workflow alone does not prove that a failed earlier release became current:
verify `/opt/klynx-rental-os/current-staging.sha` and the running container's
Compose working directory after a successful retry.

For a compatible rollback, dispatch **Promote tested commit to production** from main with a previously successful staged commit in `release_sha`. The selected commit must remain reachable from staging and main. Never roll back to the pre-tenant demo-auth/unprotected API. Database/schema migrations and Odoo image changes need their own backup and compatibility review.

Backups, restore acceptance and complete first-rollout checks are documented in [MULTITENANCY.md](../deploy/MULTITENANCY.md).
